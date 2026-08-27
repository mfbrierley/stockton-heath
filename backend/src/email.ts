// Notification email for Local Offers.
//
// Sent through the Gmail API over HTTPS rather than SMTP. DigitalOcean blocks
// outbound SMTP (ports 25, 465 and 587) on every droplet and declined to lift
// it, so nodemailer could never open a connection. The Gmail API runs on 443,
// which is not blocked, and mail genuinely comes from the Google account that
// authorised it - so it has Gmail's own deliverability rather than a
// third party's.
//
// Hand-rolled against fetch rather than pulling in googleapis: the droplet has
// 1GB of RAM and a history of deploys failing on disk, and this needs no
// dependency at all.
//
// Configured lazily like the other integrations: nothing here throws at boot,
// because a missing mail setting must not take weather, bins, fuel and bridge
// alerts down with it. If email isn't configured the send is skipped and
// logged, and whatever the business was doing still succeeds.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

interface Message {
  to: string;
  subject: string;
  body: string;
}

// Access tokens last an hour. Cached so a burst of notifications doesn't
// fetch a new one for each.
let cachedToken: { value: string; expiresAt: number } | null = null;
let configWarned = false;

const oauthConfig = (): { id: string; secret: string; refresh: string } | null => {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) {
    if (!configWarned) {
      console.error(
        "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN are not all set - email is disabled",
      );
      configWarned = true;
    }
    return null;
  }
  return { id, secret, refresh };
};

const getAccessToken = async (): Promise<string | null> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const config = oauthConfig();
  if (!config) return null;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.id,
      client_secret: config.secret,
      refresh_token: config.refresh,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    // The usual cause is a revoked refresh token: Google drops these when the
    // account password is reset, and after 7 days while the OAuth app is still
    // in "Testing". Both need the setup script running again.
    console.error(
      `Gmail token refresh failed (${response.status}): ${await response.text()}`,
    );
    return null;
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    console.error("Gmail token refresh returned no access token");
    return null;
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
};

const senderAddress = (): string => process.env.GMAIL_ADDRESS ?? "";

const fromHeader = (): string => {
  const address = senderAddress();
  return process.env.MAIL_FROM ?? `Stockton Heath <${address}>`;
};

// Where the app's owner wants to hear about new listings and payments.
// Defaults to the sending account, which is the common case.
const ownerAddress = (): string | null =>
  process.env.OWNER_EMAIL ?? process.env.GMAIL_ADDRESS ?? null;

const isAscii = (value: string): boolean => /^[\x20-\x7E]*$/.test(value);

// A header carrying anything outside plain ASCII - an accented business name,
// a curly apostrophe - has to be encoded, or the header is invalid.
const encodeHeader = (value: string): string =>
  isAscii(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;

const buildMessage = (message: Message): string => {
  // Base64 with CRLF folding: the bodies here have lines well over the 998
  // characters a raw message is allowed.
  const body = Buffer.from(message.body, "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");

  const headers = [
    `From: ${fromHeader()}`,
    `To: ${message.to}`,
    `Subject: ${encodeHeader(message.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ].join("\r\n");

  return `${headers}\r\n\r\n${body}`;
};

// Gmail wants the whole RFC 2822 message base64url encoded.
const toRaw = (message: string): string =>
  Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

// Never rejects. Notification is a side effect of someone's action, so a mail
// failure must not turn their successful save into an error. Failures are
// logged loudly enough to find later.
export const send = async (message: Message): Promise<void> => {
  try {
    const token = await getAccessToken();
    if (!token) return;

    const response = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: toRaw(buildMessage(message)) }),
    });

    if (!response.ok) {
      console.error(
        `Failed to send "${message.subject}" to ${message.to} (${response.status}): ${await response.text()}`,
      );
    }
  } catch (error) {
    console.error(
      `Failed to send "${message.subject}" to ${message.to}:`,
      error instanceof Error ? error.message : error,
    );
  }
};

// Deliberately not awaited by callers: the business's request shouldn't wait
// on Google. `send` swallows its own errors, so there is no unhandled
// rejection.
export const notify = (message: Message): void => {
  void send(message);
};

export const notifyOwner = (subject: string, body: string): void => {
  const to = ownerAddress();
  if (!to) {
    console.error("OWNER_EMAIL/GMAIL_ADDRESS are not set - owner not notified");
    return;
  }
  notify({ to, subject, body });
};

// ── Templates ─────────────────────────────────────────────────────────────────

const PORTAL = (): string =>
  process.env.PORTAL_BASE_URL ?? "https://stockton-heath-support.vercel.app/business";

const SIGN_OFF = "\n\nStockton Heath\nThe community app for the village";

interface ListingSummary {
  businessName: string;
  discountText: string;
  description: string;
  contactEmail: string;
  active: boolean;
}

// A discount now saves on its own, before anything is paid for, so this is
// worth sending again: it confirms we have it and says what is still missing.
// The owner is deliberately not copied - a listing nobody is paying for is
// not theirs to approve yet, and saying so every time would fill their inbox
// with people who never come back.
export const listingCreated = (listing: ListingSummary): void => {
  notify({
    to: listing.contactEmail,
    subject: "We've got your discount",
    body:
      `Thanks for adding ${listing.businessName} to Stockton Heath Discounts.\n\n` +
      `Your discount: ${listing.discountText}\n\n` +
      (listing.active
        ? `A real person reads every discount before it appears in the app, ` +
          `usually within 24 hours. We'll email you as soon as yours is live.\n`
        : `It's saved, but residents can't see it yet — that needs a ` +
          `subscription. It's £20 a month, you can cancel any time, and you ` +
          `can start it here:\n${PORTAL()}/listing\n\n` +
          `Once it's running, a real person reads your discount before it ` +
          `appears in the app, usually within 24 hours.\n`) +
      SIGN_OFF,
  });
};

export const listingUpdated = (
  listing: ListingSummary,
  discountChanged: boolean,
): void => {
  // Nobody has been told this listing exists yet, so there is nothing to
  // correct. Editing before paying is part of writing the discount, not a
  // change to something already out there - and both messages below would
  // be untrue: it has never been in the app, and there is no subscription
  // for it to be unaffected.
  if (!listing.active) return;

  notify({
    to: listing.contactEmail,
    subject: discountChanged
      ? "We're checking your new discount"
      : "Your listing has been updated",
    body: discountChanged
      ? `You've changed the discount for ${listing.businessName} to:\n\n` +
        `${listing.discountText}\n\n` +
        `Because the discount itself changed, it comes out of the app until ` +
        `we've read the new one. We'll email you when it's back. Your ` +
        `subscription and payments aren't affected.` +
        SIGN_OFF
      : `Your listing for ${listing.businessName} has been updated. ` +
        `Your discount is unchanged, so it stays in the app as it was.` +
        SIGN_OFF,
  });

  if (discountChanged) {
    notifyOwner(
      `Discount changed, needs approving: ${listing.businessName}`,
      `${listing.businessName} has changed their discount and dropped back ` +
        `into the approval queue.\n\n` +
        `New discount: ${listing.discountText}\n` +
        `Contact: ${listing.contactEmail}\n\n` +
        `Review it here:\n${PORTAL()}/admin\n`,
    );
  }
};

export const listingApproved = (listing: ListingSummary): void => {
  notify({
    to: listing.contactEmail,
    subject: listing.active
      ? "Your discount is live in the app"
      : "Your discount has been approved",
    body: listing.active
      ? `Good news — the discount for ${listing.businessName} has been ` +
        `approved and is now live in the Stockton Heath app.\n\n` +
        `Residents can see it right now.\n\n` +
        `You can change it any time here:\n${PORTAL()}/listing` +
        SIGN_OFF
      : `The discount for ${listing.businessName} has been approved.\n\n` +
        `It will appear in the app as soon as your subscription is active. ` +
        `You can set that up here:\n${PORTAL()}/listing` +
        SIGN_OFF,
  });
};

// An admin has taken their discount out of the app. Nothing else told them:
// the removal cancels their subscription at Stripe, and the webhook that
// fires arrives to find the row already deleted, so it matches nothing and
// says nothing. Without this they find out by noticing.
//
// The owner is not copied - they are the one who just did it.
export const listingRemoved = (listing: ListingSummary): void => {
  notify({
    to: listing.contactEmail,
    subject: "Your discount has been taken out of the app",
    body:
      `We've removed the discount for ${listing.businessName} from the ` +
      `Stockton Heath app, so residents can no longer see it.\n\n` +
      `The discount was: ${listing.discountText}\n\n` +
      // Said first and plainly, because it is the part with money in it.
      (listing.active
        ? `Your £20 a month has been stopped, so you won't be charged again.\n\n`
        : "") +
      `If you think this is a mistake, or you'd like to know why, just reply ` +
      `to this email and a person will get back to you.` +
      SIGN_OFF,
  });
};

// Sent when the subscription starts, which is also the moment the discount
// is really saved: a listing written but never paid for is nobody's news, so
// nothing goes out before this.
export const subscriptionStarted = (listing: ListingSummary, approved: boolean): void => {
  notify({
    to: listing.contactEmail,
    // A different subject from the one they got when they saved it, so the
    // two never look like the same email sent twice.
    subject: approved
      ? "Your discount is live in the app"
      : "Your subscription is set up",
    body: approved
      ? `Thanks — your £20 a month for ${listing.businessName} is set up, and ` +
        `your discount is live in the Stockton Heath app.\n\n` +
        `Your discount: ${listing.discountText}\n\n` +
        `You can change it any time here:\n${PORTAL()}/listing` +
        SIGN_OFF
      : `Thanks — your £20 a month for ${listing.businessName} is set up.\n\n` +
        `Your discount: ${listing.discountText}\n\n` +
        `A real person reads every discount before it appears in the app, ` +
        `usually within 24 hours. We'll email you as soon as yours is live — ` +
        `there's nothing else for you to do.\n\n` +
        `You can change it any time here:\n${PORTAL()}/listing` +
        SIGN_OFF,
  });

  notifyOwner(
    approved
      ? `New subscriber: ${listing.businessName}`
      : `New subscriber to approve: ${listing.businessName}`,
    `${listing.businessName} has started a subscription.\n\n` +
      `Discount: ${listing.discountText}\n` +
      `Description: ${listing.description || "(none given)"}\n` +
      `Contact: ${listing.contactEmail}\n` +
      `Approved: ${approved ? "yes - they are now live in the app" : "not yet - still needs approving"}\n\n` +
      (approved ? "" : `Review it here:\n${PORTAL()}/admin\n`),
  );
};
