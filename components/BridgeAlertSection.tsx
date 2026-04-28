import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "../app/styles/theme";

type BridgeAlert = {
  id: number;
  tweetId: string;
  tweetText: string;
  postedAt: string;
  detectedAt: string;
};

const parseTwitterDate = (dateStr: string): Date => {
  // Twitter format: "Sun Apr 19 18:19:05 +0000 2026"
  // Rearrange to ISO-compatible: "2026-04-19T18:19:05Z"
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const parts = dateStr.split(" ");
  // parts: ["Sun", "Apr", "19", "18:19:05", "+0000", "2026"]
  const month = months[parts[1]] ?? "01";
  const day = parts[2].padStart(2, "0");
  const time = parts[3];
  const year = parts[5];
  return new Date(`${year}-${month}-${day}T${time}Z`);
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDate = (date: Date): string => {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function BridgeAlertSection() {
  const [latestAlert, setLatestAlert] = useState<BridgeAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      console.error("BridgeAlertSection: EXPO_PUBLIC_BACKEND_URL is not set");
      return;
    }

    const url = `${backendUrl}/bridge-alerts/latest`;
    console.log("BridgeAlertSection fetching:", url);

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setLatestAlert(data.latestAlert ?? null);
      })
      .catch((err) => {
        console.error("BridgeAlertSection fetch error:", err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !latestAlert) {
    return null;
  }

  const alertTime = parseTwitterDate(latestAlert.postedAt);

  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name="history"
          size={24}
          color={theme.colors.primary}
        />
      </View>
      <View style={styles.details}>
        <Text style={styles.title}>Last Bridge Closure</Text>
      </View>
      <View style={styles.timeContainer}>
        <Text style={styles.time}>{formatDate(alertTime)}</Text>
        <Text style={styles.status}>{formatTime(alertTime)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.neutral100,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    width: "100%",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.neutral300,
    justifyContent: "center",
    alignItems: "center",
  },
  details: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: theme.fontSizes.body,
    color: theme.colors.neutral1000,
  },
  subtitle: {
    fontFamily: "PlusJakartaSans",
    fontSize: 14,
    color: theme.colors.neutral700,
  },
  timeContainer: {
    alignItems: "flex-end",
    gap: 2,
  },
  time: {
    fontFamily: "PlusJakartaSansBold",
    fontSize: theme.fontSizes.body,
    color: theme.colors.neutral1000,
  },
  status: {
    fontFamily: "PlusJakartaSans",
    fontSize: 14,
    color: theme.colors.neutral700,
  },
});
