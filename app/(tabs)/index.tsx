import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, View } from "react-native";
import { GreetingCard } from "../../components/GreetingCard";
import { LocalFuelSection } from "../../components/LocalFuelSection";
import {
  WeatherApiResponse,
  WeatherSection,
} from "../../components/WeatherSection";
import { theme } from "../styles/theme";

const LATITUDE = 53.3705;
const LONGITUDE = -2.5811;

const MS_TO_MPH = 2.237;

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeatherApiResponse | null>(null);

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
        <GreetingCard data={data} windMph={windMph} />
        <WeatherSection
          data={data}
          loading={loading}
          error={error}
          windMph={windMph}
        />
        <LocalFuelSection />
      </Animated.ScrollView>
    </View>
  );
}
