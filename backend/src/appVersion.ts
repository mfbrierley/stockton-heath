// The newest version of the app in the stores, served to the app at
// /app-version so it can ask people on an older one to update.
//
// Read hourly from Apple's public iTunes lookup, which only reports a version
// once it is live in the App Store, so nobody is asked to update to something
// they can't get yet. Google Play has no public equivalent. Both stores are
// released together from one workflow and Google usually approves first, so
// Android is given the App Store's version too. If Google is still reviewing
// when Apple goes live, set LATEST_ANDROID_VERSION to the version Android can
// actually get (e.g. 1.0.10) and remove it once Play has the new one.

const LOOKUP_URL =
  "https://itunes.apple.com/lookup?bundleId=com.mattbrierley1.stocktonheath&country=gb";

export const APP_VERSION_REFRESH_MS = 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 30_000;

const VERSION = /^\d+(\.\d+)*$/;

let appStoreVersion: string | null = null;

/** Null for a platform until a version is known: the app then asks nothing. */
export const getLatestAppVersion = () => {
  const android = process.env.LATEST_ANDROID_VERSION?.trim();
  return {
    ios: appStoreVersion,
    android: android && VERSION.test(android) ? android : appStoreVersion,
  };
};

// Never throws. A failed read keeps the last version.
export const syncAppVersion = async (): Promise<void> => {
  try {
    const res = await fetch(LOOKUP_URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`App Store lookup failed: ${res.status}`);
      return;
    }
    const json = (await res.json()) as { results?: { version?: unknown }[] };
    const version = json.results?.[0]?.version;
    if (typeof version !== "string" || !VERSION.test(version)) {
      console.error("App Store lookup had no version for the app");
      return;
    }
    if (version !== appStoreVersion) {
      console.log(
        `[${new Date().toISOString()}] App Store version is ${version}.`,
      );
    }
    appStoreVersion = version;
  } catch (error) {
    console.error(
      "App Store lookup error:",
      error instanceof Error ? error.message : error,
    );
  }
};
