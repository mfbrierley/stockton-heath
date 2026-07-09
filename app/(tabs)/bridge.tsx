import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BridgeAlertSection from "../../components/BridgeAlertSection";
import BridgeAlertSubscribeSection from "../../components/BridgeAlertSubscribeSection";
import BridgeClosuresChart from "../../components/BridgeClosuresChart";
import Button from "../../components/Button";
import SponsorBadge from "../../components/SponsorBadge";
import { registerForPushNotifications } from "../../hooks/usePushNotifications";
import { globalStyles } from "../styles/globalStyles";
import { theme } from "../styles/theme";

const BRIDGE_NOTIFICATIONS_KEY = "bridgeNotificationsEnabled";

type SubscribeOutcome = "success" | "permission-denied" | "error";

export default function Bridge() {
  const [notificationsEnabled, setNotificationsEnabled] = useState<
    boolean | null
  >(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const appState = useRef(AppState.currentState);

  const checkPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionDenied(status === "denied");

    const storedEnabled = await AsyncStorage.getItem(BRIDGE_NOTIFICATIONS_KEY);
    const isSubscribed = storedEnabled === "true";
    setNotificationsEnabled(isSubscribed && status === "granted");

    // Self-heal: if user has opted in and permission is still granted,
    // silently re-register in case the token has rotated since last launch.
    if (isSubscribed && status === "granted") {
      void registerAndSubscribeBridge();
    }
  };

  const registerAndSubscribeBridge = async (): Promise<SubscribeOutcome> => {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!backendUrl) return "error";

    const { granted, token } = await registerForPushNotifications();
    if (!granted) return "permission-denied";
    if (!token) return "error";

    try {
      const response = await fetch(`${backendUrl}/bridge-subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      return response.ok ? "success" : "error";
    } catch (error) {
      console.error("Failed to register bridge subscription:", error);
      return "error";
    }
  };

  useEffect(() => {
    void checkPermissions();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        void checkPermissions();
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  const handleEnableNotifications = async () => {
    if (permissionDenied) {
      await Linking.openSettings();
      return;
    }
    setLoading(true);
    try {
      const outcome = await registerAndSubscribeBridge();
      if (outcome === "success") {
        await AsyncStorage.setItem(BRIDGE_NOTIFICATIONS_KEY, "true");
        setNotificationsEnabled(true);
      } else if (outcome === "permission-denied") {
        setPermissionDenied(true);
      } else {
        Alert.alert(
          "Couldn't enable notifications",
          "Something went wrong. Please check your connection and try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      const { token } = await registerForPushNotifications();
      if (backendUrl && token) {
        await fetch(`${backendUrl}/bridge-subscriptions`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      }
    } catch (error) {
      console.error("Failed to remove bridge subscription:", error);
    } finally {
      // Clear local state regardless so the UI reflects the user's intent.
      await AsyncStorage.setItem(BRIDGE_NOTIFICATIONS_KEY, "false");
      setNotificationsEnabled(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      style={{ backgroundColor: theme.colors.neutral200, flex: 1 }}
    >
      <BridgeAlertSection />
      <SponsorBadge />
      {notificationsEnabled === true ? (
        <View style={styles.activeNotificationsCard}>
          <View style={styles.activeNotificationsRow}>
            <Feather name="bell" size={20} color={theme.colors.primary} />
            <Text style={[globalStyles.body, globalStyles.bodyBold]}>
              Alert notifications active
            </Text>
          </View>
          <Text style={globalStyles.body}>
            You&apos;ll receive a notification around 20 minutes before the
            swing bridges close, so you can plan your journey.
          </Text>
          <Button
            variant="neutral"
            width="full"
            icon={
              <Feather
                name="bell-off"
                size={20}
                color={theme.colors.neutral1000}
              />
            }
            onPress={() => void handleDisableNotifications()}
          >
            Turn off notifications
          </Button>
        </View>
      ) : (
        <BridgeAlertSubscribeSection
          loading={loading}
          onPress={() => void handleEnableNotifications()}
        />
      )}
      <View style={styles.dataCard}>
        <Text
          style={[globalStyles.body, globalStyles.bodyBold, { fontSize: 18 }]}
        >
          This week&apos;s activity
        </Text>
        <BridgeClosuresChart />
      </View>
      <View style={styles.dataCard}>
        <Text
          style={[globalStyles.body, globalStyles.bodyBold, { fontSize: 18 }]}
        >
          This month&apos;s activity
        </Text>
        <BridgeClosuresChart period={30} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: theme.colors.neutral200,
    padding: 16,
    gap: 16,
  },
  dataCard: {
    backgroundColor: theme.colors.neutral100,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    width: "100%",
  },
  activeNotificationsCard: {
    backgroundColor: theme.colors.neutral100,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    width: "100%",
  },
  activeNotificationsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
