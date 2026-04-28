import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import BridgeAlertSection from "../../components/BridgeAlertSection";
import BridgeAlertSubscribeSection from "../../components/BridgeAlertSubscribeSection";
import { theme } from "../styles/theme";

const registerForPushNotifications = async (): Promise<boolean> => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return false;

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  console.log("Expo push token:", token);

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backendUrl) return false;

  await fetch(`${backendUrl}/push-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  return true;
};

export default function Bridge() {
  const [notificationsEnabled, setNotificationsEnabled] = useState<
    boolean | null
  >(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const appState = useRef(AppState.currentState);

  const checkPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(status === "granted");
    setPermissionDenied(status === "denied");
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
    const granted = await registerForPushNotifications();
    setNotificationsEnabled(granted);
    if (!granted) setPermissionDenied(true);
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <BridgeAlertSection />
      <BridgeAlertSubscribeSection
        notificationsEnabled={notificationsEnabled}
        loading={loading}
        onPress={() => void handleEnableNotifications()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutral200,
    padding: 16,
    gap: 16,
  },
});
