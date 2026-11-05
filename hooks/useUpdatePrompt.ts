import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import { Alert, AppState, Linking, Platform } from "react-native";
import { shouldAskToUpdate, UPDATE_PROMPT_SNOOZE_MS } from "../utils/appVersion";

// Asks people on an older version of the app to update from the store, so
// they get things like the Discounts tab that only come with a new version.
// Checked every time the app opens or comes back to the screen, against the
// newest version in the stores (backend/src/appVersion.ts). "Not now" and
// "Update" both hold the question back for three days, so someone who
// hasn't updated is asked again, but not every time they look.
//
// Only JavaScript and modules every build already has, so this also reaches
// older versions in an over-the-air update.

const SNOOZE_KEY = "updatePromptSnoozedUntil";

const STORE_LINKS = Platform.select({
  ios: {
    app: "itms-apps://apps.apple.com/app/id6763075468",
    web: "https://apps.apple.com/gb/app/id6763075468",
  },
  android: {
    app: "market://details?id=com.mattbrierley1.stocktonheath",
    web: "https://play.google.com/store/apps/details?id=com.mattbrierley1.stocktonheath",
  },
});

// One alert at a time: opening the app and coming back to it can both ask.
let asking = false;

async function askIfOutOfDate(): Promise<void> {
  const store = STORE_LINKS;
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (asking || !store || !backendUrl) return;
  asking = true;
  let shown = false;
  try {
    const saved = await AsyncStorage.getItem(SNOOZE_KEY).catch(() => null);
    const snoozedUntil = saved === null ? null : Number(saved);
    if (snoozedUntil !== null && snoozedUntil > Date.now()) return;

    const res = await fetch(`${backendUrl}/app-version`);
    if (!res.ok) return;
    const versions = (await res.json()) as Record<string, unknown>;

    // Under the appVersion runtime policy the runtime version is the
    // installed app's version, and it can't be changed by an update.
    const installed = Updates.runtimeVersion ?? Constants.expoConfig?.version;
    if (
      !shouldAskToUpdate({
        latest: versions[Platform.OS],
        installed,
        snoozedUntil,
        now: Date.now(),
      })
    ) {
      return;
    }

    const answered = () => {
      asking = false;
      AsyncStorage.setItem(
        SNOOZE_KEY,
        String(Date.now() + UPDATE_PROMPT_SNOOZE_MS),
      ).catch(() => {});
    };
    shown = true;
    Alert.alert(
      "Update available",
      "A new version of Stockton Heath is ready, with the latest features.",
      [
        { text: "Not now", style: "cancel", onPress: answered },
        {
          text: "Update",
          isPreferred: true,
          onPress: () => {
            answered();
            Linking.openURL(store.app).catch(() =>
              Linking.openURL(store.web).catch(() => {}),
            );
          },
        },
      ],
      // Android: tapping outside the alert counts as "Not now".
      { cancelable: true, onDismiss: answered },
    );
  } catch {
    // Offline or the backend is down: ask another time.
  } finally {
    if (!shown) asking = false;
  }
}

/** Asks once `ready` (the splash and any welcome prompt are out of the way). */
export function useUpdatePrompt(ready: boolean) {
  useEffect(() => {
    if (!ready || __DEV__ || Platform.OS === "web") return;
    void askIfOutOfDate();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void askIfOutOfDate();
    });
    return () => subscription.remove();
  }, [ready]);
}
