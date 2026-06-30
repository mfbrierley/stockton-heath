import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import {
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

export default function Bridge() {
  // TODO: remove – forces enabled state for simulator UI testing
  const [notificationsEnabled, setNotificationsEnabled] = useState<
    boolean | null
  >(true);
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

  const registerAndSubscribeBridge = async (): Promise<boolean> => {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!backendUrl) return false;

    const { granted, token } = await registerForPushNotifications();
    if (!granted || !token) return false;

    await fetch(`${backendUrl}/bridge-subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    return true;
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
    const success = await registerAndSubscribeBridge();
    if (success) {
      await AsyncStorage.setItem(BRIDGE_NOTIFICATIONS_KEY, "true");
      setNotificationsEnabled(true);
    } else {
      setPermissionDenied(true);
    }
    setLoading(false);
  };

  const handleDisableNotifications = async () => {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    const { token } = await registerForPushNotifications();
    if (backendUrl && token) {
      await fetch(`${backendUrl}/bridge-subscriptions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    }
    await AsyncStorage.setItem(BRIDGE_NOTIFICATIONS_KEY, "false");
    setNotificationsEnabled(false);
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
          Last 30 days activity
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
