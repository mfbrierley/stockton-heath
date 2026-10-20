import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, View } from "react-native";
import BinReminderCard from "../../components/BinReminderCard";
import BridgeAlertsCard from "../../components/BridgeAlertsCard";
import DiscountsCard from "../../components/DiscountsCard";
import { GreetingCard } from "../../components/GreetingCard";
import { LocalFuelSection } from "../../components/LocalFuelSection";
import NhsDentistsAnnouncement from "../../components/NhsDentistsAnnouncement";
import QuickLinkCard from "../../components/QuickLinkCard";
import SponsorCard from "../../components/SponsorCard";
import {
  WeatherApiResponse,
  WeatherSection,
} from "../../components/WeatherSection";
import { useDiscountsLive } from "../../hooks/useDiscountsLive";
import { useUserName } from "../../hooks/useUserName";
import { globalStyles } from "../styles/globalStyles";
import { theme } from "../styles/theme";

const MS_TO_MPH = 2.237;

export default function Index() {
  const { firstName } = useUserName();
  const discountsLive = useDiscountsLive();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeatherApiResponse | null>(null);

  // The backend reads OpenWeather every ten minutes and every phone shares
  // that one reading, so opening the app costs no call on the account.
  useEffect(() => {
    let isMounted = true;

    async function fetchWeather() {
      try {
        setLoading(true);
        setError(null);

        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
        if (!backendUrl) throw new Error("EXPO_PUBLIC_BACKEND_URL is not set");

        const response = await fetch(`${backendUrl}/weather`);
        if (!response.ok) throw new Error(`${response.status}`);

        const json = (await response.json()) as { data: WeatherApiResponse };
        if (isMounted) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Weather request failed:", err);
        if (isMounted) {
          setError("Weather is unavailable right now.");
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
  }, []);

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
        <NhsDentistsAnnouncement
          onPress={() => router.push("/nhs-dentists")}
        />
        <WeatherSection
          data={data}
          loading={loading}
          error={error}
          windMph={windMph}
        />
        <LocalFuelSection />
        <SponsorCard />
        {/* Guarded on the same switch as the tab itself: with the tab hidden
            the route is still reachable, and a card that pushed residents
            into it would defeat the point of hiding it. */}
        {discountsLive && (
          <DiscountsCard
            onPress={() => router.push("/(tabs)/discounts" as never)}
          />
        )}
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
