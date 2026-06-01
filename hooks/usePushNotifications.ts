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

    if (finalStatus !== "granted") return { granted: false, token: null };

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return { granted: false, token: null };

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return { granted: true, token };
  };
