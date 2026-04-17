import { PrismaLibSql } from "@prisma/adapter-libsql";
import "dotenv/config";
import express, { Request, Response } from "express";
import { PrismaClient } from "./generated/prisma/client";

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
      console.error("twitterapi.io request failed");
      return null;
    }

    const data = await response.json();
    const tweets: any[] = data?.tweets ?? [];

    console.log(
      `Found ${tweets.length} new tweet(s). Query: ${query}. Time: ${new Date().toISOString()}`,
    );

    console.log("Raw API response:", JSON.stringify(data, null, 2));

    if (tweets.length === 0) return null;

    for (const tweet of tweets) {
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

const SWING_BRIDGE_USER_NAME = "bridgetestwa";

void syncLatestBridgeAlert(SWING_BRIDGE_USER_NAME);

setInterval(
  () => {
    void syncLatestBridgeAlert(SWING_BRIDGE_USER_NAME);
  },
  10 * 60 * 1000,
);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
