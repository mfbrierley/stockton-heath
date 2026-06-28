import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";

type WeatherSectionProps = {
  data: WeatherApiResponse | null;
  loading: boolean;
  error: string | null;
  windMph: number | undefined;
};

export type WeatherApiResponse = {
  current: {
    temp: number;
    feels_like: number;
    wind_speed: number; // m/s
    sunset: number; // unix timestamp
    weather: {
      id: number;
      description: string;
      icon: string;
    }[];
  };
  hourly: {
    pop: number; // probability of precipitation, 0–1
  }[];
};

type StatTileProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  subText?: string;
  subTextColor?: string;
};

function StatTile({
  icon,
  label,
  value,
  subText,
  subTextColor,
}: StatTileProps) {
  return (
    <View
      style={[globalStyles.card, globalStyles.cardWhite, globalStyles.tile]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <View>{icon}</View>
        <Text
          style={[globalStyles.body, globalStyles.bodyBold, { fontSize: 12 }]}
        >
          {label}
        </Text>
      </View>
      <Text
        style={[
          globalStyles.body,
          globalStyles.bodyBold,
          { fontSize: 20, lineHeight: 28 },
        ]}
      >
        {value}
      </Text>
      {subText ? (
        <Text
          style={[
            globalStyles.body,
            { fontSize: 14, color: subTextColor ?? theme.colors.primary },
          ]}
        >
          {subText}
        </Text>
      ) : null}
    </View>
  );
}

function getWindLevel(mph: number): { label: string; color: string } {
  if (mph < 12) return { label: "Low", color: theme.colors.statusGreen };
  if (mph < 25) return { label: "Moderate", color: theme.colors.statusAmber };
  return { label: "High", color: theme.colors.statusRed };
}

function LiveDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [opacity]);

  return (
    <View style={styles.liveContainer}>
      <Animated.View style={[styles.liveDot, { opacity }]} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

export function WeatherSection({
  data,
  loading,
  error,
  windMph,
}: WeatherSectionProps) {
  const weatherIcon = data?.current?.weather?.[0]?.icon;
  const rawDescription = data?.current?.weather?.[0]?.description ?? "";
  const weatherSummary =
    rawDescription.charAt(0).toUpperCase() + rawDescription.slice(1);

  const sunsetTime = data?.current.sunset
    ? new Date(data.current.sunset * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const chanceOfRain =
    data?.hourly?.[0]?.pop !== undefined
      ? `${Math.round(data.hourly[0].pop * 100)}%`
      : "—";

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={[globalStyles.heading]}>Today&apos;s Weather</Text>
        <LiveDot />
      </View>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={[globalStyles.body, styles.statusText]}>
            Loading weather...
          </Text>
        </View>
      ) : null}

      {!loading && error ? (
        <Text style={[globalStyles.body, styles.errorText]}>{error}</Text>
      ) : null}

      {!loading && !error && data ? (
        <View>
          <View style={globalStyles.tilesRow}>
            <StatTile
              icon={
                <Image
                  source={{
                    uri: `https://openweathermap.org/img/wn/${weatherIcon}@2x.png`,
                  }}
                  style={styles.icon}
                  contentFit="cover"
                />
              }
              label="CONDITIONS"
              value={`${Math.round(data.current.temp)}°C`}
              subText={weatherSummary}
            />
            <StatTile
              icon={
                <Feather name="wind" size={24} color={theme.colors.green500} />
              }
              label="WIND SPEED"
              value={windMph !== undefined ? `${windMph} mph` : "—"}
              subText={
                windMph !== undefined ? getWindLevel(windMph).label : undefined
              }
              subTextColor={
                windMph !== undefined ? getWindLevel(windMph).color : undefined
              }
            />
          </View>
          <View style={globalStyles.tilesRow}>
            <StatTile
              icon={
                <Feather
                  name="cloud-rain"
                  size={24}
                  color={theme.colors.green500}
                />
              }
              label="RAIN"
              value={chanceOfRain}
            />
            <StatTile
              icon={
                <Feather
                  name="sunset"
                  size={24}
                  color={theme.colors.green500}
                />
              }
              label="SUNSET"
              value={sunsetTime}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.neutral200,
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    color: theme.colors.neutral200,
  },
  errorText: {
    color: theme.colors.neutral200,
  },
  temp: {
    fontSize: 24,
  },
  icon: {
    width: 48,
    height: 48,
    marginLeft: -12,
    marginRight: -8,
    marginBottom: -14,
    marginTop: -8,
  },
  liveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.neutral800,
  },
  liveText: {
    fontFamily: "PlusJakartaSansBold",
    fontSize: 12,
    color: theme.colors.neutral800,
    letterSpacing: 1,
  },
});
