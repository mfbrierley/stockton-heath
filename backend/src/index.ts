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

// ── Local Offers: admin routes ────────────────────────────────────────────────

app.get("/business-listings/pending", requireAdmin, async (req: Request, res: Response) => {
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
    return res.json(listing);
  } catch (error) {
    return handleListingError(error, res);
  }
};

app.post("/business-listings/:id/approve", requireAdmin, (req: Request, res: Response) =>
  setListingApproval(req, res, true),
);

app.post("/business-listings/:id/unapprove", requireAdmin, (req: Request, res: Response) =>
  setListingApproval(req, res, false),
);

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
    const description = cleanListingField(req.body?.description, LISTING_FIELD_LIMITS.description);

    if (!businessName || !discountText || !description) {
      return res.status(400).json({
        error: "businessName, discountText and description are all required",
      });
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

app.patch("/business-listings/me", requireBusinessAuth, async (req: Request, res: Response) => {
  try {
    const existing = listingOf(req);
    if (!existing) return res.status(404).json({ error: NO_LISTING_ERROR });

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
      const value = cleanListingField(req.body[field], LISTING_FIELD_LIMITS[field]);
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
    if (
      updates.discountText !== undefined &&
      updates.discountText !== existing.discountText
    ) {
      updates.approved = false;
    }

    updates.updatedAt = new Date().toISOString();

    const listing = await prisma.businessListing.update({
      where: { id: existing.id },
      data: updates,
    });

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
    const params: CheckoutSessionParams = {
      mode: "subscription",
      managed_payments: { enabled: false },
      line_items: [{ price: requireEnv("STRIPE_PRICE_ID"), quantity: 1 }],
      client_reference_id: String(listing.id),
      metadata: { listingId: String(listing.id) },
      // Copied onto the subscription so the later subscription.* webhooks can
      // find the listing without relying on the customer mapping.
      subscription_data: { metadata: { listingId: String(listing.id) } },
      ...(listing.stripeCustomerId
        ? { customer: listing.stripeCustomerId }
        : { customer_email: listing.contactEmail }),
      success_url: `${portalBase}/billing?checkout=success`,
      cancel_url: `${portalBase}/billing?checkout=cancelled`,
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

    const session = await getStripe().billingPortal.sessions.create({
      customer: listing.stripeCustomerId,
      return_url: `${normaliseBaseUrl(requireEnv("PORTAL_BASE_URL"))}/billing`,
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
    await getStripe().subscriptions.update(listing.stripeSubscriptionId, {
      cancel_at_period_end: true,
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
        if (subscriptionId) {
          const subscription =
            await getStripe().subscriptions.retrieve(subscriptionId);
          subscriptionStatus = subscription.status;
        }

        await prisma.businessListing.updateMany({
          where: { id: listingId },
          data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus,
            active: PAID_SUBSCRIPTION_STATUSES.has(subscriptionStatus),
            updatedAt: now,
          },
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
        await prisma.businessListing.updateMany({
          where: Number.isInteger(listingId)
            ? { id: listingId }
            : { stripeSubscriptionId: subscription.id },
          data: {
            subscriptionStatus: deleted ? "canceled" : subscription.status,
            active: !deleted && PAID_SUBSCRIPTION_STATUSES.has(subscription.status),
            updatedAt: now,
          },
        });
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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
