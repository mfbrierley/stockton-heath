import { PrismaLibSql } from "@prisma/adapter-libsql";
import { setDefaultResultOrder } from "dns";
import "dotenv/config";
import express, { Request, Response } from "express";
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
          `Fuel Finder prices request failed: ${res.status} — ${body}`,
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
        `[${new Date().toISOString()}] Fuel price sync failed — retaining last cached data.`,
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

const sendPushNotifications = async (alert: BridgeAlert): Promise<void> => {
  const tokens = await prisma.pushToken.findMany();
  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: "default",
    title: "Stockton Heath Bridge Alert",
    body: alert.tweetText,
    data: { tweetId: alert.tweetId },
  }));

  const response = await fetch("https://exp.host/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    console.error("Failed to send push notifications:", await response.text());
  } else {
    console.log(`Push notifications sent to ${tokens.length} device(s).`);
  }
};

const app = express();
const port = 3001;

app.use(express.json());

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter });

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

app.get("/test-key", (req: Request, res: Response) => {
  res.json({
    hasKey: Boolean(process.env.TWITTERAPI_IO_API_KEY),
  });
});

app.get(
  "/bridge-alerts/check/:userName",
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

app.post("/push-tokens", async (req: Request, res: Response) => {
  try {
    const { token } = req.body as { token: string };
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Invalid token" });
    }
    await prisma.pushToken.upsert({
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

app.get("/fuel-prices", (req: Request, res: Response) => {
  if (!cachedFuelPrices) {
    return res.status(503).json({ error: "Fuel prices not yet available" });
  }
  return res.json(cachedFuelPrices);
});

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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
