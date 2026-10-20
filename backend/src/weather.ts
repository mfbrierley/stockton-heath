// Today's weather for Stockton Heath, read from OpenWeather's One Call API 3.0
// every ten minutes and served to the app from memory.
//
// The app used to call OpenWeather itself, from every phone, with the key
// built into the app. Every time someone opened the app was a call on the
// account, and One Call 3.0 is free for 1,000 calls a day and charged per call
// past that, so the bill grew with the number of residents - and anyone could
// lift the key out of the app and spend it. Read here, it is 144 calls a day
// however many people open the app, and the key stays on the droplet.
//
// Only `current` and `hourly` are asked for: the app shows nothing from the
// minute-by-minute, daily or alerts parts. Both are passed on exactly as
// OpenWeather sends them, so the app's type for the reply is OpenWeather's own.

const ONE_CALL_URL = "https://api.openweathermap.org/data/3.0/onecall";

// The same point nhs.uk is searched from.
const LATITUDE = 53.3705;
const LONGITUDE = -2.5811;

export const WEATHER_REFRESH_MS = 10 * 60 * 1000;

// Past this the last good reading is withheld and the app says the weather is
// unavailable. The app labels the weather LIVE, and once OpenWeather has been
// failing for an hour the last reading no longer is.
const MAX_AGE_MS = 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 30_000;

type OneCall = {
  current: Record<string, unknown>;
  hourly: Record<string, unknown>[];
};

let cached: { data: OneCall; fetchedAt: number } | null = null;
let configWarned = false;

export const getCachedWeather = () =>
  cached && Date.now() - cached.fetchedAt <= MAX_AGE_MS ? cached : null;

// Never throws. This runs on a timer inside the same process as the fuel,
// bins and bridge alerts. A failed read keeps the last good one.
export const syncWeather = async (): Promise<void> => {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    if (!configWarned) {
      console.error("OPENWEATHER_API_KEY is not set - weather is disabled");
      configWarned = true;
    }
    return;
  }

  try {
    const params = new URLSearchParams({
      lat: String(LATITUDE),
      lon: String(LONGITUDE),
      units: "metric",
      exclude: "minutely,daily,alerts",
      appid: key,
    });
    const res = await fetch(`${ONE_CALL_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      console.error(`OpenWeather request failed: ${res.status} - ${body}`);
      return;
    }

    // The app reads `current` without checking it is there, so a reply
    // without it would break the Home screen for everyone until the next read.
    const json = (await res.json()) as Partial<OneCall>;
    if (typeof json.current?.temp !== "number" || !Array.isArray(json.hourly)) {
      console.error("OpenWeather reply had no current or hourly weather");
      return;
    }

    cached = {
      data: { current: json.current, hourly: json.hourly },
      fetchedAt: Date.now(),
    };
  } catch (error) {
    console.error(
      "Weather sync error:",
      error instanceof Error ? error.message : error,
    );
  }
};
