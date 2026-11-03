import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import { isNewerVersion } from "../utils/version";

// Tells someone on an older version of the app that their store has a newer
// one. Without it nothing does: a phone with automatic updates off can sit on
// an old version for months, and an over-the-air update can't reach it - those
// only go to phones on the version they were built for. So a phone on 1.0.7
// never gets the Discounts tab, which arrived in 1.0.8, unless someone tells
// its owner to update.
//
// The backend reads which version each store is giving out
// (backend/src/storeVersions.ts), so this appears only once the new version
// can actually be downloaded - never while it's still in review - and Android
// and iPhone are told separately, since one store often goes live before the
// other. If the backend can't say, nothing shows.
//
// Closing it hides it until the next version, not for good.

const DISMISSED_KEY = "updateBannerDismissedVersion";

const APP_STORE_URL = "https://apps.apple.com/app/id6763075468";
const PLAY_STORE_URL = "market://details?id=com.mattbrierley1.stocktonheath";
const PLAY_WEB_URL =
  "https://play.google.com/store/apps/details?id=com.mattbrierley1.stocktonheath";

const installed = Constants.expoConfig?.version;

const platform =
  Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;

const openStore = () => {
  if (platform === "ios") {
    void Linking.openURL(APP_STORE_URL).catch(() => {});
  } else {
    // The Play Store app, or the Play website on a phone without it.
    void Linking.openURL(PLAY_STORE_URL).catch(() => {
      void Linking.openURL(PLAY_WEB_URL).catch(() => {});
    });
  }
};

const storeName = platform === "ios" ? "the App Store" : "Google Play";

/** Offers an update when the store has a newer version than this one. */
export default function UpdateBanner() {
  // The newer version on offer, or null when there's nothing to show.
  const [available, setAvailable] = useState<string | null>(null);

  // Checked at start-up and whenever the app comes back to the foreground, so
  // someone who never closes the app still hears about a release.
  useEffect(() => {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!platform || !installed || !backendUrl) return;
    let isMounted = true;

    const check = async () => {
      try {
        const res = await fetch(`${backendUrl}/store-versions`);
        if (!res.ok) return;
        const json = (await res.json()) as Record<string, unknown>;
        const latest = json[platform];
        if (typeof latest !== "string" || !isNewerVersion(latest, installed)) {
          if (isMounted) setAvailable(null);
          return;
        }
        const dismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(
          () => null,
        );
        if (isMounted) setAvailable(dismissed === latest ? null : latest);
      } catch {
        // Offline or the backend is down: leave it as it was.
      }
    };

    void check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  const dismiss = () => {
    if (!available) return;
    AsyncStorage.setItem(DISMISSED_KEY, available).catch(() => {});
    setAvailable(null);
  };

  if (!available) return null;

  return (
    <View style={styles.banner}>
      <Pressable
        onPress={openStore}
        style={styles.body}
        accessibilityRole="link"
        accessibilityLabel={`Update available: a newer version of the app is ready. Update on ${storeName}`}
      >
        <Feather
          name="download"
          size={20}
          color={theme.colors.primary}
          style={{ marginTop: 2 }}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={globalStyles.bodySmall}>
            <Text style={globalStyles.bodyBold}>Update available: </Text>a newer
            version of the app is ready, with the latest features and fixes.
          </Text>
          <View style={styles.linkRow}>
            <Text
              style={[
                globalStyles.bodySmall,
                globalStyles.bodyBold,
                globalStyles.bodyLink,
              ]}
            >
              Update on {storeName}
            </Text>
            <Feather
              name="arrow-right"
              size={14}
              color={theme.colors.green800}
            />
          </View>
        </View>
      </Pressable>
      <Pressable
        onPress={dismiss}
        hitSlop={12}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Feather name="x" size={18} color={theme.colors.neutral700} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.green100,
    borderWidth: 1,
    borderColor: theme.colors.green200,
    borderRadius: 16,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 8,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  close: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
