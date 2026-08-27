import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import cors from "cors";
import { createHash, timingSafeEqual } from "crypto";
import { setDefaultResultOrder } from "dns";
import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import Stripe from "stripe";
import {
  invoicePaid,
  listingApproved,
  listingCreated,
  listingRemoved,
  listingUpdated,
  subscriptionReminder,
  userSignedUp,
  welcomeUser,
  subscriptionStarted,
} from "./email";
import { subscriptionPeriod } from "./subscription";
import { PrismaClient } from "./generated/prisma/client";

setDefaultResultOrder("ipv4first");

// ── Fuel Finder ────────────────────────────────────────────────────────────────

const FUEL_FINDER_TOKEN_URL =
  "https://www.fuel-finder.service.gov.uk/api/v1/oauth/generate_access_token";
const FUEL_FINDER_PRICES_URL =
  "https://www.fuel-finder.service.gov.uk/api/v1/pfs/fuel-prices";

const LOCAL_STATION_NODE_IDS = new Set([
  "78e106b10ddec09572a290959030b50fbe237f6913711e24d5a465fbe6220e61", // Wilderspool Causeway
  "751b9cfbdf59cba708c06226acef37f63dae67b933732d7c67976daf58af7d39", // Latchford
  "0ee49af1acdf5301f588d07afc3d9c274bfbffd56a3cb25cf830dfd336b6d7ae", // Morrisons
]);

const STATION_DISPLAY_INFO: Record<
  string,
  { display_name: string; location: string }
> = {
  "78e106b10ddec09572a290959030b50fbe237f6913711e24d5a465fbe6220e61": {
    display_name: "ASDA Causeway",
    location: "Wilderspool Causeway",
  },
  "751b9cfbdf59cba708c06226acef37f63dae67b933732d7c67976daf58af7d39": {
    display_name: "ESSO Latchford",
    location: "Knutsford Road",
  },
  "0ee49af1acdf5301f588d07afc3d9c274bfbffd56a3cb25cf830dfd336b6d7ae": {
    display_name: "Morrisons",
    location: "Stockton Heath",
  },
};

const DISPLAY_FUEL_TYPES = new Set(["E10", "B7_STANDARD"]);

type FuelPrice = {
  fuel_type: string;
  price: number;
  price_last_updated: string;
  price_change_effective_timestamp: string;
};

type StationPrices = {
  node_id: string;
  trading_name: string;
  display_name: string;
  location: string;
  public_phone_number: string | null;
  fuel_prices: FuelPrice[];
};

let cachedFuelToken: { value: string; expiresAt: number } | null = null;
let cachedFuelPrices: { data: StationPrices[]; fetchedAt: number } | null =
  null;

async function getFuelFinderToken(): Promise<string> {
  if (cachedFuelToken && Date.now() < cachedFuelToken.expiresAt - 60_000) {
    return cachedFuelToken.value;
  }

  const clientId = process.env.FUEL_FINDER_CLIENT_ID;
  const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing FUEL_FINDER_CLIENT_ID or FUEL_FINDER_CLIENT_SECRET",
    );
  }

  const res = await fetch(FUEL_FINDER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!res.ok) {
    throw new Error(
      `Fuel Finder token request failed: ${res.status} ${await res.text()}`,
    );
  }

  const json = (await res.json()) as {
    data: { access_token: string; expires_in: number };
  };

  cachedFuelToken = {
    value: json.data.access_token,
    expiresAt: Date.now() + json.data.expires_in * 1000,
  };

  return cachedFuelToken.value;
}

async function syncFuelPrices(): Promise<void> {
  try {
    const token = await getFuelFinderToken();
    const results: StationPrices[] = [];
    let batch = 1;
    let syncFailed = false;

    while (true) {
      const res = await fetch(
        `${FUEL_FINDER_PRICES_URL}?batch-number=${batch}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        const body = await res.text().catch(() => "(unreadable)");
        console.error(
          `Fuel Finder prices request failed: ${res.status} - ${body}`,
        );
        syncFailed = true;
        break;
      }

      const data = (await res.json()) as StationPrices[];

      if (!Array.isArray(data) || data.length === 0) break;

      for (const station of data) {
        if (LOCAL_STATION_NODE_IDS.has(station.node_id)) {
          const displayInfo = STATION_DISPLAY_INFO[station.node_id];
          results.push({
            ...station,
            display_name: displayInfo?.display_name ?? station.trading_name,
            location: displayInfo?.location ?? "",
            fuel_prices: station.fuel_prices.filter((p) =>
              DISPLAY_FUEL_TYPES.has(p.fuel_type),
            ),
          });
        }
      }

      if (results.length === LOCAL_STATION_NODE_IDS.size) break;

      batch++;
    }

    if (syncFailed) {
      console.warn(
        `[${new Date().toISOString()}] Fuel price sync failed - retaining last cached data.`,
      );
      return;
    }

    cachedFuelPrices = { data: results, fetchedAt: Date.now() };
    console.log(
      `[${new Date().toISOString()}] Fuel prices synced. ${results.length} local station(s) found.`,
    );
  } catch (error) {
    console.error("Fuel price sync error:", error);
  }
}

// ── End Fuel Finder ────────────────────────────────────────────────────────────

type BridgeAlert = {
  tweetId: string;
  tweetText: string;
  postedAt: string;
  detectedAt: string;
};
const mapTweetToBridgeAlert = (tweet: any): BridgeAlert => {
  return {
    tweetId: tweet.id,
    tweetText: tweet.text,
    postedAt: tweet.createdAt,
    detectedAt: new Date().toISOString(),
  };
};

const BRIDGE_ORDER = [
  { pattern: /Knutsford Road/i, name: "Knutsford Road" },
  { pattern: /London Road/i, name: "London Road" },
  { pattern: /Chester Road/i, name: "Chester Road" },
];

type ParsedBridgeAlert = {
  body: string;
  firstBridge: string | null;
  closureMinutes: number | null;
};

const parseBridgeAlert = (tweetText: string): ParsedBridgeAlert => {
  const timeMatch = tweetText.match(
    /in (?:about|approximately|around)?\s*(\d+)\s*minutes?/i,
  );
  const closureMinutes = timeMatch ? parseInt(timeMatch[1], 10) : null;
  const timePart = closureMinutes
    ? `in around ${closureMinutes} mins`
    : "shortly";

  const firstBridge = BRIDGE_ORDER.map((b) => ({
    name: b.name,
    index: tweetText.search(b.pattern),
  }))
    .filter((b) => b.index !== -1)
    .sort((a, b) => a.index - b.index)[0];

  const firstBridgeName = firstBridge?.name ?? null;
  const bridgePart = firstBridgeName ? ` - ${firstBridgeName} first` : "";

  return {
    body: `⚠️ 🚢 Swing Bridges closing ${timePart}${bridgePart}.`,
    firstBridge: firstBridgeName,
    closureMinutes,
  };
};

type ExpoPushMessage = {
  to: string;
  sound: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type ExpoPushTicket = {
  status: string;
  message?: string;
  details?: { error?: string };
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_SIZE = 100;

// Sends messages to Expo in batches of 100 (Expo's per-request limit) and
// returns the tokens Expo reports as DeviceNotRegistered so the caller can
// prune them from the database.
const sendExpoPush = async (
  messages: ExpoPushMessage[],
): Promise<{ invalidTokens: string[]; sent: number; failed: number }> => {
  const invalidTokens: string[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += EXPO_PUSH_BATCH_SIZE) {
    const batch = messages.slice(i, i + EXPO_PUSH_BATCH_SIZE);

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        console.error(
          `Expo push request failed: ${response.status} -`,
          await response.text().catch(() => "(unreadable)"),
        );
        failed += batch.length;
        continue;
      }

      const result = (await response.json()) as { data?: ExpoPushTicket[] };
      const tickets = result.data ?? [];

      tickets.forEach((ticket, index) => {
        if (ticket.status === "ok") {
          sent++;
          return;
        }
        failed++;
        if (ticket.details?.error === "DeviceNotRegistered") {
          invalidTokens.push(batch[index].to);
        }
      });
    } catch (error) {
      console.error("Expo push request error:", error);
      failed += batch.length;
    }
  }

  return { invalidTokens, sent, failed };
};

// Removes tokens Expo has flagged as unregistered (app uninstalled) so we stop
// wasting sends on them and avoid getting throttled.
const pruneInvalidTokens = async (
  kind: "bridge" | "bin",
  tokens: string[],
): Promise<void> => {
  if (tokens.length === 0) return;
  try {
    if (kind === "bridge") {
      await prisma.bridgeSubscription.deleteMany({
        where: { token: { in: tokens } },
      });
    } else {
      await prisma.binSubscription.deleteMany({
        where: { token: { in: tokens } },
      });
    }
    console.log(`Pruned ${tokens.length} unregistered ${kind} token(s).`);
  } catch (error) {
    console.error(`Failed to prune ${kind} tokens:`, error);
  }
};

const sendPushNotifications = async (alert: BridgeAlert): Promise<void> => {
  const tokens = await prisma.bridgeSubscription.findMany();
  if (tokens.length === 0) {
    console.log(
      "No bridge subscriptions registered - skipping notification send.",
    );
    return;
  }

  const parsed = parseBridgeAlert(alert.tweetText);

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: "default",
    title: "Stockton Heath Bridge Alert",
    body: parsed.body,
    data: {
      tweetId: alert.tweetId,
      firstBridge: parsed.firstBridge,
      closureMinutes: parsed.closureMinutes,
      sentAt: Date.now(),
    },
  }));

  const { invalidTokens, sent } = await sendExpoPush(messages);
  await pruneInvalidTokens("bridge", invalidTokens);

  console.log(
    `Bridge push notifications: ${sent}/${tokens.length} delivered successfully.`,
  );
};

const app = express();
const port = 3001;

// Stripe signs the exact bytes it sends, so its webhook needs the raw body.
// Registered above the global JSON parser: body-parser marks the request as
// already read, so express.json() then leaves this one path alone.
app.use("/stripe/webhook", express.raw({ type: "application/json" }));

app.use(express.json());

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter });

// ── Admin auth ─────────────────────────────────────────────────────────────────

// Guards the endpoints that cost money (twitterapi.io) or reach every user's
// device (push). Fails closed: with no ADMIN_TOKEN set these routes refuse
// rather than fall open.
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    console.error("ADMIN_TOKEN is not set - refusing admin request");
    return res.status(503).json({ error: "Admin access is not configured" });
  }

  // Hash both sides so timingSafeEqual always gets equal-length buffers, and
  // so the comparison can't leak the expected token's length.
  const provided = req.get("x-admin-token") ?? "";
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();

  if (!timingSafeEqual(providedHash, expectedHash)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
};

const isWithinPollingHours = (): boolean => {
  const ukHour = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/London",
    }).format(new Date()),
    10,
  );
  return ukHour >= 6 && ukHour < 22;
};

const syncLatestBridgeAlert = async (
  userName: string,
): Promise<BridgeAlert | null> => {
  if (!isWithinPollingHours()) {
    console.log(
      `[${new Date().toISOString()}] Outside polling hours (6am–10pm UK), skipping.`,
    );
    return null;
  }

  try {
    const apiKey = process.env.TWITTERAPI_IO_API_KEY;

    if (!apiKey) {
      console.error("Missing TWITTERAPI_IO_API_KEY");
      return null;
    }

    console.log(
      `[${new Date().toISOString()}] Checking for new bridge alerts...`,
    );

    const lastStored = await prisma.bridgeAlert.findFirst({
      orderBy: { id: "desc" },
    });

    let query = `"Swingbridge Alert" from:${userName}`;

    if (lastStored) {
      const sinceTime =
        Math.floor(new Date(lastStored.postedAt).getTime() / 1000) + 1;
      query += ` since_time:${sinceTime}`;
    }

    const params = new URLSearchParams({ query, queryType: "Latest" });
    const response = await fetch(
      `https://api.twitterapi.io/twitter/tweet/advanced_search?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
        },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `twitterapi.io request failed: ${response.status} ${errorBody}`,
      );
      return null;
    }

    const data = await response.json();
    const tweets: any[] = data?.tweets ?? [];

    console.log(
      `Found ${tweets.length} new tweet(s). Query: ${query}. Time: ${new Date().toISOString()}`,
    );

    if (tweets.length === 0) return null;

    for (const tweet of [...tweets].reverse()) {
      const alert = mapTweetToBridgeAlert(tweet);
      const existingAlert = await prisma.bridgeAlert.findUnique({
        where: { tweetId: alert.tweetId },
      });
      if (!existingAlert) {
        await prisma.bridgeAlert.create({
          data: {
            tweetId: alert.tweetId,
            tweetText: alert.tweetText,
            postedAt: alert.postedAt,
            detectedAt: alert.detectedAt,
          },
        });
        console.log("New bridge alert saved:", alert.tweetText);
        await sendPushNotifications(alert);
      }
    }

    return mapTweetToBridgeAlert(tweets[0]);
  } catch (error) {
    console.error("Polling error:", error);
    return null;
  }
};

app.get("/", (req: Request, res: Response) => {
  res.send("Backend is running");
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get("/test-key", requireAdmin, (req: Request, res: Response) => {
  res.json({
    hasKey: Boolean(process.env.TWITTERAPI_IO_API_KEY),
  });
});

app.post(
  "/bridge-alerts/test-notification",
  requireAdmin,
  async (req: Request, res: Response) => {
    const fakeAlert: BridgeAlert = {
      tweetId: `test-${Date.now()}`,
      tweetText:
        "⚠️[TEST]⚠️ Swingbridge Alert: Chester Road, London Road & Knutsford Road swing bridges will be closing at 14:00 today for approximately 20 minutes. ",
      postedAt: new Date().toISOString(),
      detectedAt: new Date().toISOString(),
    };
    try {
      await sendPushNotifications(fakeAlert);
      return res.json({ ok: true, alert: fakeAlert });
    } catch (error) {
      console.error("Test notification error:", error);
      return res
        .status(500)
        .json({ error: "Failed to send test notification" });
    }
  },
);

app.get(
  "/bridge-alerts/check/:userName",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const userName = req.params.userName as string;
      const latestAlert = await syncLatestBridgeAlert(userName);

      return res.json({
        userName,
        fetchedAt: new Date().toISOString(),
        latestAlert,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Something went wrong" });
    }
  },
);

app.get("/bridge-alerts", async (req: Request, res: Response) => {
  try {
    const alerts = await prisma.bridgeAlert.findMany({
      orderBy: {
        id: "desc",
      },
    });

    return res.json(alerts);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/bridge-alerts/latest", async (req: Request, res: Response) => {
  try {
    const latestAlert = await prisma.bridgeAlert.findFirst({
      orderBy: {
        id: "desc",
      },
    });

    return res.json({
      latestAlert,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/bridge-subscriptions", async (req: Request, res: Response) => {
  try {
    const { token } = req.body as { token: string };
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Invalid token" });
    }
    await prisma.bridgeSubscription.upsert({
      where: { token },
      update: {},
      create: { token },
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.delete("/bridge-subscriptions", async (req: Request, res: Response) => {
  try {
    const { token } = req.body as { token: string };
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Invalid token" });
    }
    await prisma.bridgeSubscription.deleteMany({ where: { token } });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/bin-subscriptions", async (req: Request, res: Response) => {
  try {
    const { token, uprn } = req.body as { token: string; uprn: string };
    if (
      !token ||
      typeof token !== "string" ||
      !uprn ||
      typeof uprn !== "string"
    ) {
      return res.status(400).json({ error: "Invalid token or uprn" });
    }
    await prisma.binSubscription.upsert({
      where: { token },
      update: { uprn },
      create: { token, uprn },
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.delete("/bin-subscriptions", async (req: Request, res: Response) => {
  try {
    const { token } = req.body as { token: string };
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Invalid token" });
    }
    await prisma.binSubscription.deleteMany({ where: { token } });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/fuel-prices", (req: Request, res: Response) => {
  if (!cachedFuelPrices) {
    return res.status(503).json({ error: "Fuel prices not yet available" });
  }
  return res.json(cachedFuelPrices);
});

// ── Local Offers ──────────────────────────────────────────────────────────────

// Local businesses pay a monthly subscription to advertise a genuine discount
// to residents. A listing only reaches the app when it is both `approved` (a
// manual editorial check that the discount is real) and `active` (Stripe says
// the subscription is paid). The two are deliberately independent: a business
// can be paying but unreviewed, or reviewed but no longer paying.

// Config is read lazily rather than validated at boot. `deploy:backend` stops
// and removes the running container before starting the new one, so throwing
// on a missing variable would take the whole backend down - weather, fuel,
// bridge alerts and bin reminders included - instead of disabling only the
// feature whose config is absent. Missing config surfaces as a 503 here, the
// same way requireAdmin behaves without ADMIN_TOKEN.
class MissingConfigError extends Error {
  constructor(name: string) {
    super(`${name} is not configured`);
    this.name = "MissingConfigError";
  }
}

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new MissingConfigError(name);
  return value;
};

const handleListingError = (error: unknown, res: Response): Response => {
  if (error instanceof MissingConfigError) {
    console.error(error.message);
    return res.status(503).json({ error: "This feature is not configured" });
  }
  console.error(error);
  return res.status(500).json({ error: "Something went wrong" });
};

let stripeClient: Stripe | null = null;
const getStripe = (): Stripe => {
  if (!stripeClient) stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return stripeClient;
};

let clerkClient: ReturnType<typeof createClerkClient> | null = null;
const getClerk = (): ReturnType<typeof createClerkClient> => {
  if (!clerkClient) {
    clerkClient = createClerkClient({ secretKey: requireEnv("CLERK_SECRET_KEY") });
  }
  return clerkClient;
};

let r2Client: S3Client | null = null;
const getR2 = (): S3Client => {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return r2Client;
};

// Selected explicitly so a column added to BusinessListing later cannot leak
// into the app response, which anyone with the app can read.
const PUBLIC_LISTING_FIELDS = {
  id: true,
  businessName: true,
  discountText: true,
  description: true,
  imageUrl: true,
} as const;

const LISTING_FIELD_LIMITS = {
  businessName: 80,
  discountText: 120,
  description: 600,
} as const;

// Managed Payments is Stripe's merchant-of-record product, enabled by default
// on the account. It adds 3.5% per transaction and requires a product tax
// code, neither of which suits selling advertising to businesses a few miles
// away - so checkout opts out explicitly rather than relying on an
// account-level default that Stripe controls. Not typed by stripe@22 yet.
type CheckoutSessionParams = Stripe.Checkout.SessionCreateParams & {
  managed_payments?: { enabled: boolean };
};

// The VAT rate to add on top of the advertised price, as a Stripe Tax Rate id.
//
// Optional, and read rather than required, because charging VAT is not ours
// to decide: until the business is VAT registered there is no number to put
// on an invoice and no lawful way to add it. Unset means the price is the
// whole of what is charged, exactly as it was before any of this existed.
//
// The portal has the matching switch (VITE_PRICE_EXCLUDES_VAT) for what it
// says the price is. The two are set together - see PROJECT_CONTEXT.md.
const vatRateIds = (): string[] | null => {
  const id = process.env.STRIPE_TAX_RATE_ID;
  return id ? [id] : null;
};

// Stripe statuses that mean the listing has been paid for.
const PAID_SUBSCRIPTION_STATUSES = new Set<string>(["active", "trialing"]);


const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const cleanListingField = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
};

// The description is where a business puts any terms, so plenty of them have
// nothing to say. Blank has to be told apart from unusable, which the
// required fields never needed to do: "" is an answer, null is a rejection.
const cleanOptionalField = (value: unknown, max: number): string | null => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > max) return null;
  return trimmed;
};

const normaliseBaseUrl = (value: string): string => value.replace(/\/+$/, "");

// The portal is a browser app on its own origin, so it needs CORS. Scoped to
// PORTAL_BASE_URL alone; the mobile app sends no Origin header and is
// unaffected, as are all the existing routes.
const portalCors = cors({
  origin: (origin, callback) => {
    const allowed = process.env.PORTAL_BASE_URL;
    if (!origin || !allowed) return callback(null, false);

    // PORTAL_BASE_URL can carry a path, because the portal may be mounted
    // under one and Stripe's redirects need it. A browser's Origin header
    // never has a path, so compare against the origin alone - otherwise a
    // PORTAL_BASE_URL like https://example.com/business can never match the
    // https://example.com the browser actually sends.
    let allowedOrigin: string;
    try {
      allowedOrigin = new URL(allowed).origin;
    } catch {
      console.error("PORTAL_BASE_URL is not a valid URL:", allowed);
      return callback(null, false);
    }

    return callback(null, origin === allowedOrigin);
  },
});

app.use("/business-listings", portalCors);
// The admin pages are part of the same browser app, so they need the same
// origin allowance. Without this the browser blocks the response before the
// portal ever sees it, whatever the route itself decides.
app.use("/admin", portalCors);

// ── Business authentication (Clerk) ───────────────────────────────────────────

// Clerk owns sign-up, passwords and password resets, so no credential ever
// reaches this backend. The portal sends the Clerk session token as a bearer
// token and this verifies it.
//
// A business signs up before it has a listing, so an authenticated caller with
// no listing is an expected state, not an error - creating one is the next
// thing they do. Routes that need an existing listing check for themselves.
type BusinessRequest = Request & {
  clerkUserId?: string;
  listing?: Awaited<ReturnType<typeof prisma.businessListing.findUnique>>;
};

const NO_LISTING_ERROR = "You do not have a listing yet";

// Clerk owns sign-up and never tells this backend about it, so the first
// authenticated request an account makes stands in for the event, and the
// WelcomedUser row is the only thing that can tell that request from every
// one after it.
//
// The insert is the lock: whoever creates the row sends the emails, so two
// requests arriving together cannot both send. The Clerk lookup happens
// before it, so a Clerk failure leaves no row and the next request tries
// again rather than marking them welcomed having sent nothing.
//
// Never awaited by the caller and never throws. A welcome that fails must
// not fail the request it was riding on.
const welcomeIfNew = async (clerkUserId: string): Promise<void> => {
  try {
    const known = await prisma.welcomedUser.findUnique({ where: { clerkUserId } });
    if (known) return;

    const user = await getClerk().users.getUser(clerkUserId);
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) return;

    try {
      await prisma.welcomedUser.create({
        data: { clerkUserId, welcomedAt: new Date().toISOString() },
      });
    } catch {
      // Lost the race on the primary key. The request that won is sending.
      return;
    }

    // The owner signing in is not a new business. The row is still written,
    // so this stops looking them up on every request they ever make.
    if (isOwnerEmail(email)) return;

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;

    welcomeUser(email, name);
    userSignedUp(email, name);
  } catch (error) {
    console.error(
      "Welcome email skipped:",
      error instanceof Error ? error.message : error,
    );
  }
};

const requireBusinessAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const header = req.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const secretKey = requireEnv("CLERK_SECRET_KEY");
    let clerkUserId: string;
    try {
      const payload = await verifyToken(token, { secretKey });
      clerkUserId = payload.sub;
    } catch (error) {
      // Logged because an unexplained 401 here is indistinguishable from a
      // wrong key, a key from a different Clerk instance, or an expired
      // token - and the difference is the whole diagnosis.
      console.error(
        "Clerk token verification failed:",
        error instanceof Error ? error.message : error,
      );
      return res.status(401).json({ error: "Unauthorized" });
    }

    const request = req as BusinessRequest;
    request.clerkUserId = clerkUserId;
    request.listing = await prisma.businessListing.findUnique({
      where: { clerkUserId },
    });

    // Anyone with a listing was welcomed long ago, so they skip this
    // entirely: the extra lookup is paid only by accounts that have not
    // written a discount, which is new signups and very little else.
    if (!request.listing) void welcomeIfNew(clerkUserId);

    return next();
  } catch (error) {
    return handleListingError(error, res);
  }
};

// Non-null only after requireBusinessAuth has run.
const callerOf = (req: Request): string => (req as BusinessRequest).clerkUserId as string;
const listingOf = (req: Request) => (req as BusinessRequest).listing ?? null;

// Everything the business is allowed to see about its own listing. Stripe's
// identifiers and the Clerk id are internal plumbing the portal never needs.
const ownListingView = <T extends { stripeCustomerId: unknown; stripeSubscriptionId: unknown; clerkUserId: unknown }>(
  listing: T,
) => {
  const { stripeCustomerId, stripeSubscriptionId, clerkUserId, ...safe } = listing;
  return safe;
};

// The owner approves listings from the portal as well as from a script, so
// admin routes accept either the shared admin token or a Clerk session token
// belonging to OWNER_EMAIL. Fails closed: with no OWNER_EMAIL set, only the
// token works, exactly as before.
const isOwnerEmail = (email: string | null | undefined): boolean => {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!owner || !email) return false;
  return email.trim().toLowerCase() === owner;
};

const callerIsOwner = async (req: Request): Promise<boolean> => {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;

  // Outside the try, like requireBusinessAuth: a missing key is a
  // configuration fault worth a 503, not a silent "not the owner".
  const secretKey = requireEnv("CLERK_SECRET_KEY");
  let clerkUserId: string;
  try {
    const payload = await verifyToken(token, { secretKey });
    clerkUserId = payload.sub;
  } catch {
    return false;
  }

  const user = await getClerk().users.getUser(clerkUserId);
  return isOwnerEmail(user.primaryEmailAddress?.emailAddress);
};

const requireAdminOrOwner = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Scripts and curl keep using the admin token, so the verification script
  // and any existing tooling are unaffected.
  if (req.get("x-admin-token")) return requireAdmin(req, res, next);

  try {
    if (!(await callerIsOwner(req))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  } catch (error) {
    return handleListingError(error, res);
  }
};

// ── Local Offers: admin routes ────────────────────────────────────────────────

app.get("/business-listings/pending", requireAdminOrOwner, async (req: Request, res: Response) => {
  try {
    // Everything awaiting review. A row with `active: true` is a business
    // already paying - either a new signup or a live listing that edited its
    // discount and dropped back into the queue.
    const listings = await prisma.businessListing.findMany({
      where: { approved: false },
      orderBy: { createdAt: "asc" },
    });
    return res.json(listings);
  } catch (error) {
    return handleListingError(error, res);
  }
});

const setListingApproval = async (
  req: Request,
  res: Response,
  approved: boolean,
): Promise<Response> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const existing = await prisma.businessListing.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Listing not found" });

    const listing = await prisma.businessListing.update({
      where: { id },
      data: { approved, updatedAt: new Date().toISOString() },
    });

    // Only on approval, and only when it's a change - re-approving something
    // already approved shouldn't email the business again.
    if (approved && !existing.approved) listingApproved(listing);

    return res.json(listing);
  } catch (error) {
    return handleListingError(error, res);
  }
};

// Stops the billing immediately rather than at the end of the period, which is
// the opposite of what a business cancelling for itself wants: an admin removing
// a listing is taking it out now, so charging for the rest of the month would be
// charging for something no resident can see.
//
// Tolerates a subscription Stripe no longer has, or one already cancelled: both
// mean the goal is met, and neither should stop the row being deleted.
const cancelSubscriptionNow = async (subscriptionId: string): Promise<void> => {
  try {
    const existing = await getStripe().subscriptions.retrieve(subscriptionId);
    if (existing.status === "canceled") return;
    await getStripe().subscriptions.cancel(subscriptionId);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "resource_missing") {
      console.error(`Subscription ${subscriptionId} no longer exists at Stripe`);
      return;
    }
    throw error;
  }
};

// Stripe keeps the customer object - their email, their name, their saved
// cards - long after a subscription ends, so deleting our row alone leaves
// their details sitting there. Looked up by email rather than by the row's
// stripeCustomerId, because a listing removed on its own takes that id with
// it and would otherwise strand the customer with nothing left pointing at
// it.
//
// Invoices and charges survive this, and are meant to: they are financial
// records, Stripe keeps them whatever happens to the customer, and they are
// not ours to throw away.
const deleteStripeCustomersFor = async (email: string): Promise<void> => {
  let customers;
  try {
    customers = await getStripe().customers.list({ email, limit: 100 });
  } catch (error) {
    // Nothing is configured, so there is nothing at Stripe to delete. Any
    // other failure is real and should stop the deletion rather than quietly
    // leave records behind.
    if (error instanceof MissingConfigError) return;
    throw error;
  }

  for (const customer of customers.data) {
    try {
      await getStripe().customers.del(customer.id);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "resource_missing") continue;
      throw error;
    }
  }
};

// Taking a listing out of the app for good. The row is deleted outright,
// which frees the business's email and Clerk id: signing in afterwards looks
// exactly like the first visit ever did, and creating a listing again is a
// normal signup rather than something the app has to specially allow.
const removeListing = async (id: number) => {
  const listing = await prisma.businessListing.findUnique({ where: { id } });
  if (!listing) return null;

  if (listing.stripeSubscriptionId) {
    await cancelSubscriptionNow(listing.stripeSubscriptionId);
  }

  // deleteMany rather than delete, for the same reason the webhooks use
  // updateMany: a row that has already gone must not throw. Two admins on the
  // page, or one double-click that outruns the disabled button, would
  // otherwise get a 500 for reaching exactly the state they asked for.
  await prisma.businessListing.deleteMany({ where: { id } });
  return listing;
};

// Everything, not just the queue: the approvals screen also shows what is
// already live, so a listing can be pulled back out if it needs to be.
app.get("/business-listings/admin", requireAdminOrOwner, async (req: Request, res: Response) => {
  try {
    const listings = await prisma.businessListing.findMany({
      orderBy: [{ approved: "asc" }, { createdAt: "desc" }],
    });
    // The same link the Users page carries, for the same reason: this page
    // shows our mirror of Stripe, and the mirror is the thing an admin might
    // want to check. Added after ownListingView rather than inside it,
    // because that strips the raw ids every other caller must not see.
    return res.json(
      listings.map((listing) => ({
        ...ownListingView(listing),
        stripeUrl: listingStripeUrl(listing),
      })),
    );
  } catch (error) {
    return handleListingError(error, res);
  }
});

app.post("/business-listings/:id/approve", requireAdminOrOwner, (req: Request, res: Response) =>
  setListingApproval(req, res, true),
);

app.post("/business-listings/:id/unapprove", requireAdminOrOwner, (req: Request, res: Response) =>
  setListingApproval(req, res, false),
);

// Unapproving hides a listing but leaves it paying; this ends both. Kept
// separate from unapprove because it spends the business's money - it stops
// their subscription there and then - so it is never something to reach for by
// accident when all that was wanted was to take a discount down for a while.
app.post("/business-listings/:id/remove", requireAdminOrOwner, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const listing = await removeListing(id);
    if (!listing) return res.status(404).json({ error: "Listing not found" });

    // Sent from the route rather than from removeListing, which deleting a
    // whole account also calls: someone whose sign-in has just been erased
    // should not be told their discount is out of the app, as if the account
    // were still there to do something about it.
    //
    // A row already stamped removedAt was taken out under the old behaviour,
    // possibly weeks ago. Clearing it now is tidying up, not news, and
    // telling them again would be the confusing part.
    if (!listing.removedAt) listingRemoved(listing);

    // Not a listing view: there is no listing left to view. `{ ok: true }`
    // matches cancel and resume, the other routes that change state without
    // handing back a record of something that still exists.
    return res.json({ ok: true });
  } catch (error) {
    return handleListingError(error, res);
  }
});

// ── Local Offers: admin user routes ───────────────────────────────────────────

// A link straight to the real thing in Stripe, so the owner can check a
// subscription's definite status rather than trusting our mirror of it.
//
// Built here rather than in the portal because the dashboard path differs
// between test and live mode and only this side knows which key is in use -
// and a link into the wrong mode is a 404 that looks like missing data.
const stripeDashboardUrl = (path: string): string | null => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Anything that is not explicitly a live key is treated as test, so a
  // sandbox or restricted key lands in the right place too.
  const prefix = /_live_/.test(key) ? "" : "test/";
  return `https://dashboard.stripe.com/${prefix}${path}`;
};

// The subscription is what the status column is about, so it wins. A customer
// who has not subscribed yet still has a page worth opening; one who has
// neither has nothing to link to.
const listingStripeUrl = (listing: {
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
}): string | null => {
  if (listing.stripeSubscriptionId) {
    return stripeDashboardUrl(`subscriptions/${listing.stripeSubscriptionId}`);
  }
  if (listing.stripeCustomerId) {
    return stripeDashboardUrl(`customers/${listing.stripeCustomerId}`);
  }
  return null;
};

// Clerk pages its user list, and the village will not fill one page for a long
// time - but "a long time" is not "never", and a silently truncated list of
// accounts is the kind of bug nobody notices until it matters.
const CLERK_PAGE_SIZE = 100;

const listClerkUsers = async () => {
  const clerk = getClerk();
  const users = [];
  let offset = 0;

  for (;;) {
    const page = await clerk.users.getUserList({
      limit: CLERK_PAGE_SIZE,
      offset,
    });
    users.push(...page.data);
    if (page.data.length < CLERK_PAGE_SIZE) break;
    offset += CLERK_PAGE_SIZE;
  }

  return users;
};

// Everyone who has ever signed up, whether or not they got as far as writing a
// discount. Clerk owns the accounts and this database owns the listings, so
// neither side alone can answer "who has signed up, and what have they got" -
// which is the only question this page exists to answer.
app.get("/admin/users", requireAdminOrOwner, async (req: Request, res: Response) => {
  try {
    const [users, listings] = await Promise.all([
      listClerkUsers(),
      prisma.businessListing.findMany(),
    ]);

    const byClerkId = new Map(
      listings
        .filter((listing) => listing.clerkUserId)
        .map((listing) => [listing.clerkUserId as string, listing]),
    );

    const rows = users.map((user) => {
      const email = user.primaryEmailAddress?.emailAddress ?? null;
      const name = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const listing = byClerkId.get(user.id) ?? null;

      return {
        id: user.id,
        email,
        name: name || null,
        // Clerk records this in milliseconds; the rest of the API speaks ISO.
        createdAt: new Date(user.createdAt).toISOString(),
        isAdmin: isOwnerEmail(email),
        listing: listing
          ? {
              id: listing.id,
              businessName: listing.businessName,
              approved: listing.approved,
              active: listing.active,
              subscriptionStatus: listing.subscriptionStatus,
              cancelAtPeriodEnd: listing.cancelAtPeriodEnd,
              currentPeriodEnd: listing.currentPeriodEnd,
              stripeUrl: listingStripeUrl(listing),
            }
          : null,
      };
    });

    // Newest first: the accounts worth looking at are almost always the ones
    // that just appeared.
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return res.json(rows);
  } catch (error) {
    return handleListingError(error, res);
  }
});

// Deleting an account is not undoable and takes their listing with it, so the
// two ways it could be a mistake are refused outright rather than warned about:
// a business that is still paying, and the owner's own account.
app.delete("/admin/users/:clerkUserId", requireAdminOrOwner, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.params.clerkUserId;
    if (typeof clerkUserId !== "string" || !clerkUserId) {
      return res.status(400).json({ error: "Invalid id" });
    }

    let user;
    try {
      user = await getClerk().users.getUser(clerkUserId);
    } catch {
      return res.status(404).json({ error: "That account no longer exists" });
    }

    const email = user.primaryEmailAddress?.emailAddress ?? null;

    // Locking yourself out of the admin pages would need a trip to the Clerk
    // dashboard to undo, and there is only ever one owner to lose.
    if (isOwnerEmail(email)) {
      return res
        .status(409)
        .json({ error: "You cannot delete your own admin account" });
    }

    // By email as well as by Clerk id. The two normally agree, but a Clerk
    // account deleted and remade with the same address leaves a row pointing
    // at the old id - and contactEmail is unique, so a row matched by neither
    // would hold that address for ever with no login left to reach it. That
    // is the opposite of freeing their email.
    const listing = await prisma.businessListing.findFirst({
      where: email
        ? { OR: [{ clerkUserId }, { contactEmail: email }] }
        : { clerkUserId },
    });

    // A paying business is never deleted by accident: end the subscription
    // first, deliberately, and then the account can go. Widening the lookup
    // above also means this now catches an orphaned row that is still being
    // charged, which it used to walk straight past.
    if (listing?.active) {
      return res.status(409).json({
        error:
          "This business has an active subscription. Remove their listing first, then delete the account.",
      });
    }

    // Stripe first, then our row, then the account. Each step is safe to
    // repeat, so a failure part-way is retried by pressing Delete again
    // rather than leaving a half-deleted person nobody can finish off:
    // a customer already gone is skipped, removeListing deletes nothing when
    // there is nothing left, and a second run simply finds no listing.
    if (email) await deleteStripeCustomersFor(email);

    // Cancels anything still open at Stripe and deletes the listing along
    // with the account, so neither is left behind pointing at the other.
    if (listing) await removeListing(listing.id);

    await getClerk().users.deleteUser(clerkUserId);

    return res.json({ ok: true });
  } catch (error) {
    return handleListingError(error, res);
  }
});

// ── Local Offers: public route (the app) ──────────────────────────────────────

app.get("/business-listings", async (req: Request, res: Response) => {
  try {
    const listings = await prisma.businessListing.findMany({
      where: { approved: true, active: true },
      select: PUBLIC_LISTING_FIELDS,
      orderBy: { businessName: "asc" },
    });
    return res.json(listings);
  } catch (error) {
    return handleListingError(error, res);
  }
});

// ── Local Offers: business routes (the portal) ────────────────────────────────

// A business signs itself up: it creates its own listing, then pays for it.
// The listing stays invisible to the app until it is both approved and paid,
// so an unwanted signup costs nothing beyond a row in the pending queue.
app.post("/business-listings/me", requireBusinessAuth, async (req: Request, res: Response) => {
  try {
    if (listingOf(req)) {
      return res.status(409).json({ error: "You already have a listing" });
    }

    const businessName = cleanListingField(req.body?.businessName, LISTING_FIELD_LIMITS.businessName);
    const discountText = cleanListingField(req.body?.discountText, LISTING_FIELD_LIMITS.discountText);
    const description = cleanOptionalField(req.body?.description, LISTING_FIELD_LIMITS.description);

    if (!businessName || !discountText) {
      return res.status(400).json({
        error: "businessName and discountText are both required",
      });
    }
    if (description === null) {
      return res.status(400).json({ error: "Invalid description" });
    }

    // Taken from the Clerk account rather than the request body, so it is
    // always an address whose owner actually signed in.
    const user = await getClerk().users.getUser(callerOf(req));
    const contactEmail = user.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
    if (!contactEmail) {
      return res.status(400).json({ error: "Your account has no email address" });
    }

    const clash = await prisma.businessListing.findUnique({ where: { contactEmail } });
    if (clash) {
      return res.status(409).json({ error: "A listing already exists for that email address" });
    }

    const now = new Date().toISOString();
    const listing = await prisma.businessListing.create({
      data: {
        businessName,
        discountText,
        description,
        contactEmail,
        clerkUserId: callerOf(req),
        createdAt: now,
        updatedAt: now,
      },
    });

    // Not awaited: the business's listing is saved either way, and a slow
    // mail server shouldn't hold up their response. Only the business hears
    // about it - the owner is told when someone actually pays.
    listingCreated(listing);

    return res.status(201).json(ownListingView(listing));
  } catch (error) {
    return handleListingError(error, res);
  }
});

app.get("/business-listings/me", requireBusinessAuth, (req: Request, res: Response) => {
  const listing = listingOf(req);
  if (!listing) return res.status(404).json({ error: NO_LISTING_ERROR });
  return res.json(ownListingView(listing));
});

// So the portal knows whether to show the approvals link. The admin routes
// enforce this themselves; this only decides what the UI offers.
app.get("/business-listings/me/is-owner", requireBusinessAuth, async (req: Request, res: Response) => {
  try {
    const user = await getClerk().users.getUser(callerOf(req));
    return res.json({
      owner: isOwnerEmail(user.primaryEmailAddress?.emailAddress),
    });
  } catch (error) {
    return handleListingError(error, res);
  }
});

app.patch("/business-listings/me", requireBusinessAuth, async (req: Request, res: Response) => {
  try {
    const existing = listingOf(req);
    if (!existing) return res.status(404).json({ error: NO_LISTING_ERROR });

    // Paid for and not yet read: it is in the approval queue, and nothing
    // changes it until someone has looked. The portal shows what is being
    // checked rather than a form, but a hidden form is only hidden - this is
    // what closes the race it exists to close, where an approval and an edit
    // land in the same second and the edit wins, putting words in the app
    // that nobody read.
    //
    // Deliberately every field, not only the discount. A name changed
    // underneath the reviewer is the same problem as a discount changed
    // underneath them: what goes live is not what was approved.
    if (existing.active && !existing.approved) {
      return res.status(409).json({
        error:
          "Your discount is being checked at the moment, so it can't be changed. It usually takes less than 24 hours, and we'll email you when it's live.",
      });
    }

    const updates: {
      businessName?: string;
      discountText?: string;
      description?: string;
      imageUrl?: string;
      approved?: boolean;
      updatedAt?: string;
    } = {};

    for (const field of ["businessName", "discountText", "description"] as const) {
      if (req.body?.[field] === undefined) continue;
      // Only the description may be cleared; emptying a name or a discount
      // would leave a listing with nothing in it.
      const value =
        field === "description"
          ? cleanOptionalField(req.body[field], LISTING_FIELD_LIMITS[field])
          : cleanListingField(req.body[field], LISTING_FIELD_LIMITS[field]);
      if (value === null) return res.status(400).json({ error: `Invalid ${field}` });
      updates[field] = value;
    }

    // Only a URL this backend just handed out may be stored, so the field
    // can't be pointed at an arbitrary host.
    if (req.body?.imageUrl !== undefined) {
      const publicBase = process.env.R2_PUBLIC_URL;
      const value = typeof req.body.imageUrl === "string" ? req.body.imageUrl.trim() : "";
      if (!publicBase || !value.startsWith(`${normaliseBaseUrl(publicBase)}/`)) {
        return res.status(400).json({ error: "Invalid imageUrl" });
      }
      updates.imageUrl = value;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Changing the discount drops the listing back to unapproved so the
    // genuine-discount rule gets re-checked. Name, description and image
    // edits don't, so fixing a typo can't pull a paying listing out of the
    // app until the next manual review.
    const discountChanged =
      updates.discountText !== undefined &&
      updates.discountText !== existing.discountText;
    if (discountChanged) {
      updates.approved = false;
    }

    updates.updatedAt = new Date().toISOString();

    const listing = await prisma.businessListing.update({
      where: { id: existing.id },
      data: updates,
    });

    listingUpdated(listing, discountChanged);

    return res.json(ownListingView(listing));
  } catch (error) {
    return handleListingError(error, res);
  }
});

app.post("/business-listings/me/checkout", requireBusinessAuth, async (req: Request, res: Response) => {
  try {
    const listing = listingOf(req);
    if (!listing) return res.status(404).json({ error: NO_LISTING_ERROR });
    if (listing.active) {
      return res.status(409).json({ error: "Subscription is already active" });
    }

    const portalBase = normaliseBaseUrl(requireEnv("PORTAL_BASE_URL"));
    const vatRates = vatRateIds();
    const params: CheckoutSessionParams = {
      mode: "subscription",
      managed_payments: { enabled: false },
      line_items: [{ price: requireEnv("STRIPE_PRICE_ID"), quantity: 1 }],
      client_reference_id: String(listing.id),
      metadata: { listingId: String(listing.id) },
      // Copied onto the subscription so the later subscription.* webhooks can
      // find the listing without relying on the customer mapping.
      //
      // The VAT rate goes on the subscription, not on this one line item:
      // Stripe copies default_tax_rates onto every invoice it raises from it,
      // so the renewals in twelve months' time carry the same VAT as the
      // first payment without anything here running again.
      subscription_data: {
        metadata: { listingId: String(listing.id) },
        ...(vatRates ? { default_tax_rates: vatRates } : {}),
      },
      ...(listing.stripeCustomerId
        ? { customer: listing.stripeCustomerId }
        : { customer_email: listing.contactEmail }),
      // Back to the page they came from: writing the discount and paying for
      // it are one step now, so both outcomes belong there rather than on a
      // billing page they never visited.
      success_url: `${portalBase}/listing?checkout=success`,
      cancel_url: `${portalBase}/listing?checkout=cancelled`,
    };

    const session = await getStripe().checkout.sessions.create(params);

    return res.json({ url: session.url });
  } catch (error) {
    return handleListingError(error, res);
  }
});

app.post("/business-listings/me/portal", requireBusinessAuth, async (req: Request, res: Response) => {
  try {
    const listing = listingOf(req);
    if (!listing) return res.status(404).json({ error: NO_LISTING_ERROR });
    if (!listing.stripeCustomerId) {
      return res.status(409).json({ error: "No subscription to manage yet" });
    }

    // Marked so the portal knows the customer has just come back from
    // changing something, and can wait for the webhook rather than trusting a
    // read that may have raced it.
    const returnUrl = `${normaliseBaseUrl(requireEnv("PORTAL_BASE_URL"))}/listing?from=portal`;

    // Stripe's portal home only offers a small "return to" link, and after an
    // action it is easy to miss - customers were left stranded there with the
    // browser's back button as the only way out. Asking for a specific flow
    // instead sends them straight to the one thing they came to do, and
    // Stripe redirects them back itself when they finish.
    const wantsCardUpdate = req.body?.flow === "payment_method_update";

    const session = await getStripe().billingPortal.sessions.create({
      customer: listing.stripeCustomerId,
      return_url: returnUrl,
      ...(wantsCardUpdate
        ? {
            flow_data: {
              type: "payment_method_update" as const,
              after_completion: {
                type: "redirect" as const,
                redirect: { return_url: returnUrl },
              },
            },
          }
        : {}),
    });

    return res.json({ url: session.url });
  } catch (error) {
    return handleListingError(error, res);
  }
});

app.post("/business-listings/me/cancel", requireBusinessAuth, async (req: Request, res: Response) => {
  try {
    const listing = listingOf(req);
    if (!listing) return res.status(404).json({ error: NO_LISTING_ERROR });
    if (!listing.stripeSubscriptionId) {
      return res.status(409).json({ error: "No subscription to cancel" });
    }

    // Stays live for the period already paid for. `active` is deliberately
    // left alone - customer.subscription.deleted is the single source of
    // truth, so cancelling here and cancelling from Stripe's own portal
    // follow identical code paths.
    const subscription = await getStripe().subscriptions.update(
      listing.stripeSubscriptionId,
      { cancel_at_period_end: true },
    );

    // Stored so the portal can still show the cancellation after a reload.
    // Taken from Stripe's response rather than assumed, so what the business
    // sees is what Stripe actually recorded.
    await prisma.businessListing.update({
      where: { id: listing.id },
      data: {
        ...subscriptionPeriod(subscription),
        updatedAt: new Date().toISOString(),
      },
    });

    return res.json({ ok: true });
  } catch (error) {
    return handleListingError(error, res);
  }
});

// Cancelling was one-way here: undoing it meant a trip to Stripe's portal,
// which is exactly the journey that stranded people. Both signals are cleared,
// since either one alone keeps the subscription marked as ending.
app.post("/business-listings/me/resume", requireBusinessAuth, async (req: Request, res: Response) => {
  try {
    const listing = listingOf(req);
    if (!listing) return res.status(404).json({ error: NO_LISTING_ERROR });
    if (!listing.stripeSubscriptionId) {
      return res.status(409).json({ error: "No subscription to restart" });
    }

    // Stripe refuses both parameters in one call - "Received both
    // cancel_at_period_end and cancel_at parameters. Please pass in only one."
    // - and which of them holds the cancellation depends on how it was made:
    // the Customer Portal sets cancel_at, while cancel_at_period_end is the
    // older signal. So clear one, then clear the other only if it survives,
    // rather than betting on which applies.
    let subscription = await getStripe().subscriptions.update(
      listing.stripeSubscriptionId,
      { cancel_at: null },
    );

    if (subscription.cancel_at_period_end) {
      subscription = await getStripe().subscriptions.update(
        listing.stripeSubscriptionId,
        { cancel_at_period_end: false },
      );
    }

    // Stored from Stripe's response rather than assumed, as the cancel route
    // does, so what the business sees is what Stripe actually recorded.
    await prisma.businessListing.update({
      where: { id: listing.id },
      data: {
        ...subscriptionPeriod(subscription),
        subscriptionStatus: subscription.status,
        active: PAID_SUBSCRIPTION_STATUSES.has(subscription.status),
        updatedAt: new Date().toISOString(),
      },
    });

    return res.json({ ok: true });
  } catch (error) {
    return handleListingError(error, res);
  }
});

app.post("/business-listings/me/image-upload-url", requireBusinessAuth, async (req: Request, res: Response) => {
  try {
    const contentType =
      typeof req.body?.contentType === "string" ? req.body.contentType : "";
    const extension = ALLOWED_IMAGE_TYPES.get(contentType);
    if (!extension) {
      return res.status(400).json({ error: "Unsupported contentType" });
    }

    const listing = listingOf(req);
    if (!listing) return res.status(404).json({ error: NO_LISTING_ERROR });

    const key = `listings/${listing.id}-${Date.now()}.${extension}`;

    const uploadUrl = await getSignedUrl(
      getR2(),
      new PutObjectCommand({
        Bucket: requireEnv("R2_BUCKET_NAME"),
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 300 },
    );

    // The portal PATCHes this back once the upload succeeds, so a failed
    // upload can't leave a broken image showing in the app.
    const imageUrl = `${normaliseBaseUrl(requireEnv("R2_PUBLIC_URL"))}/${key}`;
    return res.json({ uploadUrl, imageUrl });
  } catch (error) {
    return handleListingError(error, res);
  }
});

// ── Local Offers: Stripe webhook ──────────────────────────────────────────────

// Authenticated by Stripe's own signature rather than ADMIN_TOKEN. The raw
// body it needs is preserved by the express.raw mount above express.json().
app.post("/stripe/webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.get("stripe-signature");
    if (!signature) return res.status(400).json({ error: "Missing signature" });

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        req.body as Buffer,
        signature,
        requireEnv("STRIPE_WEBHOOK_SECRET"),
      );
    } catch (error) {
      if (error instanceof MissingConfigError) throw error;
      console.error(
        "Stripe signature verification failed:",
        error instanceof Error ? error.message : error,
      );
      return res.status(400).json({ error: "Invalid signature" });
    }

    const now = new Date().toISOString();

    // Logged because delivery is the hard part to see from the outside: an
    // event Stripe records is not necessarily an event Stripe sends, and
    // without this the two are indistinguishable from the server.
    console.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const listingId = Number(
          session.client_reference_id ?? session.metadata?.listingId,
        );
        if (!Number.isInteger(listingId)) {
          console.error("checkout.session.completed without a listing id");
          break;
        }

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription?.id ?? null);
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : (session.customer?.id ?? null);

        let subscriptionStatus = "incomplete";
        let period: ReturnType<typeof subscriptionPeriod> = {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
        };
        if (subscriptionId) {
          const subscription =
            await getStripe().subscriptions.retrieve(subscriptionId);
          subscriptionStatus = subscription.status;
          period = subscriptionPeriod(subscription);
        }

        const checkoutUpdate = await prisma.businessListing.updateMany({
          where: { id: listingId },
          data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus,
            active: PAID_SUBSCRIPTION_STATUSES.has(subscriptionStatus),
            ...period,
            updatedAt: now,
          },
        });
        if (checkoutUpdate.count === 0) {
          console.error(
            `checkout.session.completed matched no listing (listingId ${listingId})`,
          );
        }

        // checkout.session.completed fires once per successful checkout, so
        // it's the one place a "someone subscribed" note can be sent without
        // repeating it on every later subscription.updated event.
        const paid = await prisma.businessListing.findUnique({
          where: { id: listingId },
        });
        if (paid) subscriptionStarted(paid, paid.approved);
        break;
      }

      // Every payment that actually leaves their bank, first and last. The
      // subscription.* events fire on status changes, which is not the same
      // thing: a renewal that goes through changes no status at all.
      case "invoice.paid": {
        const invoice = event.data.object;

        // A £0 invoice is not a payment. Stripe raises them for trials and
        // for periods a credit covers in full, and a receipt for nothing
        // would be worse than silence.
        if (!invoice.amount_paid) break;

        // parent.subscription_details is where the subscription lives in the
        // current API. Falling back to the customer covers an invoice raised
        // outside a subscription, which should not happen here but costs one
        // line to survive.
        const parentSubscription = invoice.parent?.subscription_details?.subscription;
        const subscriptionId =
          typeof parentSubscription === "string"
            ? parentSubscription
            : (parentSubscription?.id ?? null);
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : (invoice.customer?.id ?? null);

        const listing = subscriptionId
          ? await prisma.businessListing.findFirst({
              where: { stripeSubscriptionId: subscriptionId },
            })
          : customerId
            ? await prisma.businessListing.findFirst({
                where: { stripeCustomerId: customerId },
              })
            : null;

        if (!listing) {
          console.error(
            `invoice.paid matched no listing (invoice ${invoice.id}, ` +
              `subscription ${subscriptionId ?? "none"}, customer ${customerId ?? "none"})`,
          );
          break;
        }

        // total_taxes is every tax line on the invoice. Summed rather than
        // taking the first, so a future second rate cannot silently vanish
        // from the "plus £x VAT" line.
        const tax = (invoice.total_taxes ?? []).reduce((sum, line) => sum + line.amount, 0);

        invoicePaid(listing, {
          total: invoice.amount_paid,
          tax,
          currency: invoice.currency,
          url: invoice.hosted_invoice_url ?? null,
          first: invoice.billing_reason === "subscription_create",
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const listingId = Number(subscription.metadata?.listingId);
        const deleted = event.type === "customer.subscription.deleted";

        // updateMany rather than update: a webhook for a listing that no
        // longer exists must not throw, or Stripe retries it indefinitely.
        const subscriptionUpdate = await prisma.businessListing.updateMany({
          where: Number.isInteger(listingId)
            ? { id: listingId }
            : { stripeSubscriptionId: subscription.id },
          data: {
            subscriptionStatus: deleted ? "canceled" : subscription.status,
            active: !deleted && PAID_SUBSCRIPTION_STATUSES.has(subscription.status),
            // Covers a cancellation made from Stripe's own portal as well as
            // ours. Once deleted there is nothing pending any more.
            ...(deleted
              ? { cancelAtPeriodEnd: false, currentPeriodEnd: null }
              : subscriptionPeriod(subscription)),
            updatedAt: now,
          },
        });
        // updateMany reports no error when it matches nothing, so a
        // subscription whose metadata points at a listing that no longer
        // exists would otherwise fail completely silently.
        if (subscriptionUpdate.count === 0) {
          console.error(
            `${event.type} matched no listing (subscription ${subscription.id}, ` +
              `metadata listingId ${subscription.metadata?.listingId ?? "none"})`,
          );
        } else {
          // Both cancellation signals logged, since which one Stripe uses
          // depends on how the cancellation was made.
          console.log(
            `${event.type} applied: status ${subscription.status}, ` +
              `cancel_at_period_end ${subscription.cancel_at_period_end}, ` +
              `cancel_at ${subscription.cancel_at ?? "null"}`,
          );
        }
        break;
      }

      default:
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    return handleListingError(error, res);
  }
});

// ── Bin Notifications ─────────────────────────────────────────────────────────

const BIN_NAME_MAP: { keyword: string; label: string }[] = [
  { keyword: "blue", label: "blue bin" },
  { keyword: "green", label: "green bin" },
  { keyword: "black", label: "black bin" },
  { keyword: "food", label: "food waste bin" },
];

const friendlyBinNames = (jobNames: string[]): string => {
  const matched = BIN_NAME_MAP.filter(({ keyword }) =>
    jobNames.some((name) => name.toLowerCase().includes(keyword)),
  ).map(({ label }) => label);
  if (matched.length === 0) return "bins";
  if (matched.length === 1) return matched[0];
  const last = matched[matched.length - 1];
  return `${matched.slice(0, -1).join(", ")} and ${last}`;
};

const getUKDateString = (date: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const BIN_NOTIFICATION_DATE_KEY = "lastBinNotificationDate";

// In-memory fallback used when the durable AppMeta store isn't available
// (e.g. the migration hasn't been applied yet). This mirrors the original
// behaviour so bin reminders keep working regardless.
let lastBinNotificationDateMemory: string | null = null;

// Reads the last date bin reminders were sent, preferring the durable AppMeta
// row and falling back to the in-memory value if the table isn't available.
const getLastBinNotificationDate = async (): Promise<string | null> => {
  try {
    const row = await prisma.appMeta.findUnique({
      where: { key: BIN_NOTIFICATION_DATE_KEY },
    });
    return row?.value ?? null;
  } catch (error) {
    console.warn(
      "AppMeta unavailable - using in-memory bin dedupe:",
      error instanceof Error ? error.message : error,
    );
    return lastBinNotificationDateMemory;
  }
};

// Records the last date bin reminders were sent. Always updates the in-memory
// fallback, and additionally persists to AppMeta when that table exists.
const setLastBinNotificationDate = async (date: string): Promise<void> => {
  lastBinNotificationDateMemory = date;
  try {
    await prisma.appMeta.upsert({
      where: { key: BIN_NOTIFICATION_DATE_KEY },
      update: { value: date },
      create: { key: BIN_NOTIFICATION_DATE_KEY, value: date },
    });
  } catch {
    // In-memory fallback already set above; durable write can catch up later.
  }
};

const checkBinNotifications = async (): Promise<void> => {
  const ukHour = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/London",
    }).format(new Date()),
    10,
  );
  if (ukHour !== 18) return;

  const todayUK = getUKDateString(new Date());
  // Set before sending so a crash/redeploy mid-send can't re-send today's
  // reminder. Falls back to in-memory dedupe if AppMeta isn't available.
  const lastSent = await getLastBinNotificationDate();
  if (lastSent === todayUK) return;
  await setLastBinNotificationDate(todayUK);

  console.log(
    `[${new Date().toISOString()}] Running 6pm bin notification check...`,
  );

  try {
    const subscriptions = await prisma.binSubscription.findMany();
    if (subscriptions.length === 0) {
      console.log("No bin subscriptions - skipping.");
      return;
    }

    const uprnMap = new Map<string, string[]>();
    for (const sub of subscriptions) {
      const existing = uprnMap.get(sub.uprn) ?? [];
      existing.push(sub.token);
      uprnMap.set(sub.uprn, existing);
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowUK = getUKDateString(tomorrow);

    const invalidBinTokens: string[] = [];

    for (const [uprn, tokens] of uprnMap) {
      try {
        const response = await fetch(
          `https://www.warrington.gov.uk/bin-collections/get-jobs/${uprn}`,
          { headers: { Referer: "https://www.warrington.gov.uk/" } },
        );
        if (!response.ok) {
          console.error(`Bin API error for UPRN ${uprn}: ${response.status}`);
          continue;
        }
        const data = await response.json();
        const schedule: { Name: string; ScheduledStart: string }[] =
          data?.schedule ?? [];
        const tomorrowCollections = schedule.filter(
          (job) => getUKDateString(new Date(job.ScheduledStart)) === tomorrowUK,
        );
        if (tomorrowCollections.length === 0) continue;

        const binNames = friendlyBinNames(
          tomorrowCollections.map((j) => j.Name),
        );
        const body = `Put out your ${binNames} tonight`;
        const messages = tokens.map((token) => ({
          to: token,
          sound: "default",
          title: "🚛 Bin collection tomorrow",
          body,
        }));

        const { invalidTokens, sent } = await sendExpoPush(messages);
        invalidBinTokens.push(...invalidTokens);
        console.log(
          `Bin notification sent for UPRN ${uprn}: "${body}" to ${sent}/${tokens.length} device(s)`,
        );
      } catch (error) {
        console.error(`Bin notification error for UPRN ${uprn}:`, error);
      }
    }

    await pruneInvalidTokens("bin", invalidBinTokens);
  } catch (error) {
    console.error("checkBinNotifications error:", error);
  }
};

// ── The one nudge ────────────────────────────────────────────────────────────

const REMINDER_AFTER_MS = 24 * 60 * 60 * 1000;
// Hourly. The gap is the resolution, not the delay: a discount written at
// 10:00 is nudged somewhere between 24 and 25 hours later, which is what
// "the next day" means to the person reading it.
const REMINDER_SWEEP_MS = 60 * 60 * 1000;

// A discount saved and then left. Written but never paid for is the one state
// where someone has done all the work and none of it counts, and nothing
// tells them so unless they come back and look.
//
// `stripeSubscriptionId: null` rather than just `active: false`: a lapsed
// business has an id, and telling someone who paid for months to "start your
// subscription" gets the story wrong. Their case is the portal's to explain.
//
// Never throws. This runs on a timer inside the same process as the weather,
// bins, fuel and bridge alerts, and a database blip at 3am must cost a
// reminder, not the village's bin notifications.
const remindUnpaidListings = async (): Promise<void> => {
  try {
    const cutoff = new Date(Date.now() - REMINDER_AFTER_MS).toISOString();
    const stale = await prisma.businessListing.findMany({
      where: {
        active: false,
        stripeSubscriptionId: null,
        createdAt: { lte: cutoff },
      },
    });
    if (stale.length === 0) return;

    // Read in one go rather than per listing: the sweep runs hourly and this
    // is almost always "all of them, still reminded".
    const already = new Set(
      (
        await prisma.remindedListing.findMany({
          where: { listingId: { in: stale.map((listing) => listing.id) } },
          select: { listingId: true },
        })
      ).map((row) => row.listingId),
    );

    for (const listing of stale) {
      if (already.has(listing.id)) continue;

      // The insert is the lock, exactly as the welcome email uses. Written
      // before sending: a crash between the two costs one reminder, where
      // the other order would send it again on every sweep for ever.
      try {
        await prisma.remindedListing.create({
          data: { listingId: listing.id, remindedAt: new Date().toISOString() },
        });
      } catch {
        continue;
      }

      console.log(
        `Reminding ${listing.businessName} (listing ${listing.id}) that they have not subscribed`,
      );
      subscriptionReminder(listing);
    }
  } catch (error) {
    console.error(
      "Unpaid-listing reminder sweep failed:",
      error instanceof Error ? error.message : error,
    );
  }
};

// ─────────────────────────────────────────────────────────────────────────────

const SWING_BRIDGE_USER_NAME = "trafficwarr";

void syncLatestBridgeAlert(SWING_BRIDGE_USER_NAME);
void syncFuelPrices();

setInterval(
  () => {
    void syncLatestBridgeAlert(SWING_BRIDGE_USER_NAME);
  },
  10 * 60 * 1000,
);

setInterval(
  () => {
    void syncFuelPrices();
  },
  30 * 60 * 1000,
);

void checkBinNotifications();
setInterval(() => {
  void checkBinNotifications();
}, 60 * 1000);

// Not run at boot. A redeploy would otherwise sweep immediately, which is
// harmless - the table stops anything being sent twice - but it means the
// first thing a deploy does is send mail, and a deploy should be a quiet
// event. The first sweep is an hour in.
setInterval(() => {
  void remindUnpaidListings();
}, REMINDER_SWEEP_MS);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
