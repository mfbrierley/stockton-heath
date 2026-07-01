import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import { registerForPushNotifications } from "../hooks/usePushNotifications";
import Button from "./Button";

const BIN_NOTIFICATIONS_KEY = "binNotificationsEnabled";

interface Props {
  uprn: string;
}

export default function BinNotificationSection({ uprn }: Props) {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const stored = await AsyncStorage.getItem(BIN_NOTIFICATIONS_KEY);
      const isSubscribed = stored === "true";
      setEnabled(isSubscribed);

      if (isSubscribed) {
        const { status } = await Notifications.getPermissionsAsync();
        if (status === "granted") {
          // Self-heal: silently re-upsert in case token has rotated.
          void resubscribe(uprn);
        } else if (status === "denied") {
          setPermissionDenied(true);
        }
      }
    };
    void init();
  }, [uprn]);

  const resubscribe = async (currentUprn: string): Promise<void> => {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!backendUrl) return;
    try {
      const { granted, token } = await registerForPushNotifications();
      if (!granted || !token) return;
      await fetch(`${backendUrl}/bin-subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, uprn: currentUprn }),
      });
    } catch (error) {
      console.error("Failed to refresh bin subscription:", error);
    }
  };

  const showTransientError = () =>
    Alert.alert(
      "Couldn't enable reminders",
      "Something went wrong. Please check your connection and try again.",
    );

  const handleEnable = async () => {
    if (permissionDenied) {
      await Linking.openSettings();
      return;
    }

    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!backendUrl) return;

    setLoading(true);
    try {
      const { granted, token } = await registerForPushNotifications();
      if (!granted) {
        setPermissionDenied(true);
        return;
      }
      if (!token) {
        showTransientError();
        return;
      }

      const response = await fetch(`${backendUrl}/bin-subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, uprn }),
      });
      if (!response.ok) {
        showTransientError();
        return;
      }

      await AsyncStorage.setItem(BIN_NOTIFICATIONS_KEY, "true");
      setEnabled(true);
    } catch (error) {
      console.error("Failed to enable bin reminders:", error);
      showTransientError();
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      const { token } = await registerForPushNotifications();
      if (backendUrl && token) {
        await fetch(`${backendUrl}/bin-subscriptions`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      }
    } catch (error) {
      console.error("Failed to remove bin subscription:", error);
    } finally {
      // Clear local state regardless so the UI reflects the user's intent.
      await AsyncStorage.setItem(BIN_NOTIFICATIONS_KEY, "false");
      setEnabled(false);
    }
  };

  return (
    <View style={[globalStyles.card, globalStyles.cardWhite, styles.container]}>
      <View style={styles.row}>
        <Feather
          name={enabled ? "bell" : "bell-off"}
          size={22}
          color={theme.colors.primary}
        />
        <Text style={[globalStyles.body, globalStyles.bodyBold, styles.label]}>
          Bin collection reminders
        </Text>
      </View>
      <Text style={[globalStyles.body, styles.description]}>
        Get a notification at 6pm the evening before your bins are collected.
      </Text>
      {enabled ? (
        <Button
          variant="ghost"
          width="full"
          icon={
            <Feather name="bell-off" size={20} color={theme.colors.primary} />
          }
          onPress={() => void handleDisable()}
          style={{ marginTop: 16 }}
        >
          Turn off reminders
        </Button>
      ) : (
        <Button
          variant="primary"
          width="full"
          icon={<Feather name="bell" size={20} color={theme.colors.white} />}
          onPress={() => void handleEnable()}
          loading={loading}
          style={{ marginTop: 16 }}
        >
          {permissionDenied ? "Open Settings" : "Enable reminders"}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  label: {
    color: theme.colors.primary,
  },
  description: {
    color: theme.colors.neutral800,
  },
});
