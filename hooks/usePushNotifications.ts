import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type RegisterResult = {
  granted: boolean;
  token: string | null;
};

export const registerForPushNotifications =
  async (): Promise<RegisterResult> => {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Permission was denied by the user - callers should surface a Settings prompt.
    if (finalStatus !== "granted") return { granted: false, token: null };

    // From here permission IS granted; any failure is transient/config-related,
    // so we report granted: true with a null token and let callers retry.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      console.error("registerForPushNotifications: missing EAS projectId");
      return { granted: true, token: null };
    }

    try {
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      return { granted: true, token };
    } catch (error) {
      console.error("Failed to fetch Expo push token:", error);
      return { granted: true, token: null };
    }
  };
