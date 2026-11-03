// The newest version of the app each store is giving out, read from the
// stores every hour so the app can tell someone on an older version that a
// newer one is waiting (components/UpdateBanner.tsx).
//
// Read from the stores rather than written down at release time. A version is
// only worth telling anyone about once they can download it, and when that is
// is up to Apple's review and Google's - a number raised in the release PR
// would send people to a store that doesn't have it yet, for hours, or for
// days as with Google in October 2026.
//
// - App Store: Apple's public lookup API, which gives the live version.
// - Google Play: there is no public API for this, so the version is read out
//   of the listing page, from the data Google embeds for its own scripts. That
//   depends on how Google builds the page, so anything other than exactly one
//   version-shaped value is refused and the last good one kept. With no value
//   the app shows no prompt on Android - a missing prompt is the safe failure;
//   a wrong one would tell everyone to update to something that isn't there.

const PACKAGE = "com.mattbrierley1.stocktonheath";

const APP_STORE_LOOKUP_URL = `https://itunes.apple.com/lookup?bundleId=${PACKAGE}&country=gb`;
const PLAY_LISTING_URL = `https://play.google.com/store/apps/details?id=${PACKAGE}&hl=en_GB&gl=GB`;

const USER_AGENT =
  "StocktonHeathApp/1.0 (community app; +https://stockton-heath-support.vercel.app)";

export const STORE_VERSIONS_REFRESH_MS = 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 30_000;

const VERSION = /^\d+(\.\d+){1,3}$/;

// How the listing page carries the version: [[["1.0.8"]]. The page's only
// other version-like value, the minimum Android version, is shaped differently.
const PLAY_VERSION = /\[\[\["(\d+(?:\.\d+){1,3})"\]\]/g;

export type StoreVersions = { ios: string | null; android: string | null };

// Null until the first good read after a restart. The app treats null as
// "nothing to offer", so a restart can only ever hide the prompt for an hour.
const cached: StoreVersions = { ios: null, android: null };

export const getStoreVersions = (): StoreVersions => ({ ...cached });

const get = async (url: string): Promise<Response | null> => {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    console.error(`Store version request failed: ${res.status} - ${url}`);
    return null;
  }
  return res;
};

const readAppStore = async (): Promise<string | null> => {
  const res = await get(APP_STORE_LOOKUP_URL);
  if (!res) return null;
  const json = (await res.json()) as { results?: { version?: unknown }[] };
  const version = json.results?.[0]?.version;
  if (typeof version !== "string" || !VERSION.test(version)) {
    console.error("App Store lookup had no version for the app");
    return null;
  }
  return version;
};

const readPlay = async (): Promise<string | null> => {
  const res = await get(PLAY_LISTING_URL);
  if (!res) return null;
  const html = await res.text();
  const found = new Set([...html.matchAll(PLAY_VERSION)].map((m) => m[1]));
  if (found.size !== 1) {
    console.error(
      `Google Play listing: expected one version, found ${found.size} (${[...found].join(", ")})`,
    );
    return null;
  }
  return [...found][0];
};

// Never throws. This runs on a timer inside the same process as the weather,
// fuel, bins and bridge alerts. Each store is read separately, so one failing
// keeps the last good value for that store and doesn't touch the other.
export const syncStoreVersions = async (): Promise<void> => {
  const [ios, android] = await Promise.allSettled([readAppStore(), readPlay()]);

  if (ios.status === "fulfilled") {
    if (ios.value) cached.ios = ios.value;
  } else {
    console.error("App Store version sync error:", errorMessage(ios.reason));
  }

  if (android.status === "fulfilled") {
    if (android.value) cached.android = android.value;
  } else {
    console.error("Google Play version sync error:", errorMessage(android.reason));
  }
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : error;
