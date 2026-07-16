import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import BinReminderCard from "../../components/BinReminderCard";
import BridgeAlertsCard from "../../components/BridgeAlertsCard";
import { GreetingCard } from "../../components/GreetingCard";
import { LocalFuelSection } from "../../components/LocalFuelSection";
import QuickLinkCard from "../../components/QuickLinkCard";
import SponsorCard from "../../components/SponsorCard";
import {
  WeatherApiResponse,
  WeatherSection,
} from "../../components/WeatherSection";
import { useUserName } from "../../hooks/useUserName";
import { globalStyles } from "../styles/globalStyles";
import { theme } from "../styles/theme";

const LATITUDE = 53.3705;
const LONGITUDE = -2.5811;

const MS_TO_MPH = 2.237;

// Expires tomorrow night (end of 2026-07-17, local time).
const ANNOUNCEMENT_EXPIRY = new Date("2026-07-18T00:00:00");
const ANNOUNCEMENT_MESSAGE =
  "After England's World Cup defeat, Lionel Messi is banned from Stockton Heath.";

export default function Index() {
  const { firstName } = useUserName();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeatherApiResponse | null>(null);

  const showAnnouncement = useMemo(
    () => Date.now() < ANNOUNCEMENT_EXPIRY.getTime(),
    [],
  );

  const endpoint = useMemo(() => {
    const apiKey = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;

    if (!apiKey) {
      throw new Error(
        "API key is missing. Restart the Expo server after adding .env",
      );
    }

    const params = new URLSearchParams({
      lat: String(LATITUDE),
      lon: String(LONGITUDE),
      units: "metric",
      appid: apiKey,
    });

    return `https://api.openweathermap.org/data/3.0/onecall?${params.toString()}`;
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchWeather() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(endpoint);
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`${response.status}: ${body}`);
        }

        const json = (await response.json()) as WeatherApiResponse;
        if (isMounted) {
          setData(json);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Weather is unavailable right now.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchWeather();

    return () => {
      isMounted = false;
    };
  }, [endpoint]);

  const windMph = useMemo(() => {
    return data ? Math.round(data.current.wind_speed * MS_TO_MPH) : undefined;
  }, [data]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const imageTranslateY = scrollY.interpolate({
    inputRange: [-1, 0, 250],
    outputRange: [0, 0, -250],
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const imageOpacity = scrollY.interpolate({
    inputRange: [0, 250],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.neutral200 }}>
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 250,
          opacity: imageOpacity,
          transform: [{ translateY: imageTranslateY }],
        }}
      >
        <Image
          source={require("../../assets/images/stockton-heath-photo.jpg")}
          style={{ width: "100%", height: 250 }}
          contentFit="cover"
        />
      </Animated.View>
      <Animated.ScrollView
        contentInsetAdjustmentBehavior="never"
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{
          paddingTop: 250,
          paddingHorizontal: 20,
          gap: 32,
          paddingBottom: 32,
        }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
      >
        <GreetingCard data={data} windMph={windMph} firstName={firstName} />
        {showAnnouncement && (
          <View
            style={[
              globalStyles.card,
              globalStyles.cardWhite,
              { padding: 20, flexDirection: "row", gap: 12 },
            ]}
          >
            <Feather
              name="alert-circle"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={[globalStyles.body, { flex: 1 }]}>
              {ANNOUNCEMENT_MESSAGE}
            </Text>
          </View>
        )}
        <WeatherSection
          data={data}
          loading={loading}
          error={error}
          windMph={windMph}
        />
        <LocalFuelSection />
        <SponsorCard />
        <BinReminderCard onPress={() => router.push("/(tabs)/services")} />
        <BridgeAlertsCard onPress={() => router.push("/(tabs)/bridge")} />
        <View style={globalStyles.divider} />
        <View style={{ gap: 16 }}>
          <QuickLinkCard
            icon={
              <Feather name="info" size={20} color={theme.colors.green700} />
            }
            title="About this app"
            backgroundColor={theme.colors.white}
            onPress={() => router.push("/about")}
          />
          <QuickLinkCard
            icon={
              <Feather
                name="help-circle"
                size={20}
                color={theme.colors.green700}
              />
            }
            title="Help"
            backgroundColor={theme.colors.white}
            onPress={() => router.push("/help")}
          />
          <QuickLinkCard
            icon={
              <Feather name="user" size={20} color={theme.colors.green700} />
            }
            title="Change my name"
            backgroundColor={theme.colors.white}
            onPress={() => router.push("/change-name" as never)}
          />
        </View>
      </Animated.ScrollView>
    </View>
  );
}
