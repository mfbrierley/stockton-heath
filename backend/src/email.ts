// Notification email for Local Offers.
//
// Sent through Gmail's SMTP with an app password, which needs no domain of
// its own and no third-party service. Gmail allows far more per day than a
// village app will ever send.
//
// Configured lazily like the other integrations: nothing here throws at boot,
// because a missing mail setting must not take weather, bins, fuel and bridge
// alerts down with it. If email isn't configured the send is skipped and
// logged, and whatever the business was doing still succeeds.
import nodemailer, { type Transporter } from "nodemailer";

interface Message {
  to: string;
  subject: string;
  body: string;
}

let transporter: Transporter | null = null;
let transportUnavailable = false;

const getTransporter = (): Transporter | null => {
  if (transporter) return transporter;
  if (transportUnavailable) return null;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) {
    console.error("SMTP_USER/SMTP_PASSWORD are not set - email is disabled");
    transportUnavailable = true;
    return null;
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
};

const fromAddress = (): string => {
  const user = process.env.SMTP_USER ?? "";
  return process.env.MAIL_FROM ?? `Stockton Heath <${user}>`;
};

// Where the app's owner wants to hear about new listings and payments.
// Defaults to the sending account, which is the common case.
const ownerAddress = (): string | null =>
  process.env.OWNER_EMAIL ?? process.env.SMTP_USER ?? null;

// Never rejects. Notification is a side effect of someone's action, so a mail
// failure must not turn their successful save into an error. Failures are
// logged loudly enough to find later.
export const send = async (message: Message): Promise<void> => {
  try {
    const transport = getTransporter();
    if (!transport) return;

    await transport.sendMail({
      from: fromAddress(),
      to: message.to,
      subject: message.subject,
      text: message.body,
    });
  } catch (error) {
    console.error(
      `Failed to send "${message.subject}" to ${message.to}:`,
      error instanceof Error ? error.message : error,
    );
  }
};

// Deliberately not awaited by callers: the business's request shouldn't wait
// on Gmail. `send` swallows its own errors, so there is no unhandled rejection.
export const notify = (message: Message): void => {
  void send(message);
};

export const notifyOwner = (subject: string, body: string): void => {
  const to = ownerAddress();
  if (!to) {
    console.error("OWNER_EMAIL/SMTP_USER are not set - owner not notified");
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

export const listingCreated = (listing: ListingSummary): void => {
  notify({
    to: listing.contactEmail,
    subject: "We've got your discount",
    body:
      `Thanks for adding ${listing.businessName} to Stockton Heath Discounts.\n\n` +
      `Your discount: ${listing.discountText}\n\n` +
      `A real person reads every discount before it appears in the app. ` +
      `We'll email you as soon as yours is live.\n\n` +
      (listing.active
        ? ""
        : `You'll also need a subscription before it can appear. You can set that up here:\n${PORTAL()}/billing\n`) +
      SIGN_OFF,
  });

  notifyOwner(
    `New listing to approve: ${listing.businessName}`,
    `${listing.businessName} has created a listing and is waiting for approval.\n\n` +
      `Discount: ${listing.discountText}\n` +
      `Description: ${listing.description}\n` +
      `Contact: ${listing.contactEmail}\n` +
      `Subscribed: ${listing.active ? "yes" : "not yet"}\n\n` +
      `Review it here:\n${PORTAL()}/admin\n`,
  );
};

export const listingUpdated = (
  listing: ListingSummary,
  discountChanged: boolean,
): void => {
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
        `You can set that up here:\n${PORTAL()}/billing` +
        SIGN_OFF,
  });
};

export const subscriptionStarted = (listing: ListingSummary, approved: boolean): void => {
  notifyOwner(
    `New subscriber: ${listing.businessName}`,
    `${listing.businessName} has started a subscription.\n\n` +
      `Contact: ${listing.contactEmail}\n` +
      `Approved: ${approved ? "yes - they are now live in the app" : "not yet - still needs approving"}\n\n` +
      (approved ? "" : `Review it here:\n${PORTAL()}/admin\n`),
  );
};
