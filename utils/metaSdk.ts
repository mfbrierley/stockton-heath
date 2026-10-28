import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";
import { AppState, Platform } from "react-native";
import { Settings } from "react-native-fbsdk-next";

// Meta's SDK is here so Facebook and Instagram ads can be run as App Promotion
// campaigns, which need Meta to see installs. It is set up in app.json and
// logs installs and app opens by itself; this only settles what it may send.
//
// On iPhone, Apple counts an ad SDK measuring installs as tracking, so the app
// asks once with Apple's "Allow tracking?" prompt (wording in app.json). If
// someone allows it, the SDK may send the advertising identifier (IDFA);
// otherwise it sends none, and Meta counts installs only in aggregate. Android
// never sends an advertising ID: AD_ID is blocked in app.json, and nothing
// here turns collection on there.
//
// iOS starts the SDK at launch whatever this does, so on a first launch the
// install can reach Meta before the answer does. That install is still
// counted, through SKAdNetwork and Meta's aggregated measurement.

let started = false;

// Apple shows the prompt only to an app in the foreground; asked any earlier
// it answers "undetermined" without showing anything.
const whenActive = (): Promise<void> =>
  new Promise((resolve) => {
    if (AppState.currentState === "active") {
      resolve();
      return;
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      subscription.remove();
      resolve();
    });
  });

export const startMetaSdk = async (): Promise<void> => {
  if (started || Platform.OS === "web") return;
  started = true;

  try {
    if (Platform.OS === "ios") {
      await whenActive();
      let { status } = await getTrackingPermissionsAsync();
      if (status === "undetermined") {
        ({ status } = await requestTrackingPermissionsAsync());
      }
      // Set on every launch, so turning tracking off later in iOS Settings
      // stops the identifier being sent from the next launch on.
      const allowed = status === "granted";
      Settings.setAdvertiserIDCollectionEnabled(allowed);
      await Settings.setAdvertiserTrackingEnabled(allowed);
    }
    Settings.initializeSDK();
  } catch (error) {
    // Ad measurement is never worth breaking the app over.
    console.warn("Meta SDK setup failed:", error);
  }
};
