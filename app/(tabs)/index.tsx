import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import RowswoodLogo from "../../assets/images/Rowswood-Timber-Logo.svg";
import { GreetingCard } from "../../components/GreetingCard";
import { LocalFuelSection } from "../../components/LocalFuelSection";
import QuickLinkCard from "../../components/QuickLinkCard";
import Button from "../../components/Button";
import {
  WeatherApiResponse,
  WeatherSection,
} from "../../components/WeatherSection";
import { globalStyles } from "../styles/globalStyles";
import { theme } from "../styles/theme";

const LATITUDE = 53.3705;
const LONGITUDE = -2.5811;

const MS_TO_MPH = 2.237;

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeatherApiResponse | null>(null);
  const [notificationTestStatus, setNotificationTestStatus] = useState<
    string | null
  >(null);

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
  // REMOVE WHEN FINISHED TESTING

  const ensureNotificationPermission = async (): Promise<boolean> => {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    if (existingStatus === "granted") {
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  };

  const scheduleBridgeTestNotification = async () => {
    const granted = await ensureNotificationPermission();
    if (!granted) {
      setNotificationTestStatus(
        "Notifications are not enabled. Please allow notifications to run tests.",
      );
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Swingbridge Alert (Test)",
        body: "Test closure notification fired after 30 seconds.",
        data: {
          tweetId: `test-${Date.now()}`,
          firstBridge: "A56",
          closureMinutes: 45,
          sentAt: Date.now(),
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 30,
      },
    });

    setNotificationTestStatus(
      "Bridge test notification scheduled for 30 seconds from now.",
    );
  };

  const scheduleBinTestNotification = async () => {
    const granted = await ensureNotificationPermission();
    if (!granted) {
      setNotificationTestStatus(
        "Notifications are not enabled. Please allow notifications to run tests.",
      );
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Bin Reminder (Test)",
        body: "Test bin reminder fired after 30 seconds.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 30,
      },
    });

    setNotificationTestStatus(
      "Bin collection test notification scheduled for 30 seconds from now.",
    );
  };

  // END OF TEST

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
        <View
          style={[globalStyles.card, globalStyles.cardWhite, styles.testCard]}
        >
          <Text
            style={[globalStyles.body, globalStyles.bodyBold, styles.testTitle]}
          >
            Testing notifications
          </Text>
          <Text style={[globalStyles.body, styles.testDescription]}>
            Temporary buttons for local notification testing only.
          </Text>
          <View style={styles.testButtonGroup}>
            <Button
              variant="secondary"
              width="full"
              onPress={() => void scheduleBridgeTestNotification()}
            >
              Test bridge alert (30s)
            </Button>
            <Button
              variant="neutral"
              width="full"
              onPress={() => void scheduleBinTestNotification()}
            >
              Test bin reminder (30s)
            </Button>
          </View>
          {notificationTestStatus ? (
            <Text style={[globalStyles.body, styles.testStatus]}>
              {notificationTestStatus}
            </Text>
          ) : null}
        </View>
        <View style={{ gap: 0 }}>
          <LocalFuelSection />
          <Pressable
            style={({ pressed }) => [
              sponsorStyles.card,
              pressed && { opacity: 0.75 },
            ]}
            onPress={() => Linking.openURL("https://www.rowswoodtimber.co.uk")}
          >
            <Text
              style={[
                globalStyles.body,
                globalStyles.bodyBold,
                sponsorStyles.title,
              ]}
            >
              About our sponsor
            </Text>
            <RowswoodLogo width={160} height={60} style={sponsorStyles.logo} />
            <Text style={[globalStyles.body, sponsorStyles.body]}>
              Rowswood Timber have been supplying quality landscaping products
              to the residents of Stockton Heath for over 50 years.
            </Text>
            <View style={sponsorStyles.linkRow}>
              <Text style={[globalStyles.body, sponsorStyles.link]}>
                rowswoodtimber.co.uk
              </Text>
              <Feather
                name="external-link"
                size={14}
                color={theme.colors.green700}
              />
            </View>
          </Pressable>
          <View
            style={{
              height: 1,
              backgroundColor: theme.colors.neutral300,
              marginVertical: 24,
            }}
          />
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
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const sponsorStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 20,
    gap: 8,
    marginTop: 32,
  },
  title: {
    color: theme.colors.green1000,
  },
  logo: {
    marginVertical: 4,
  },
  body: {
    color: theme.colors.neutral800,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  link: {
    color: theme.colors.green700,
    fontSize: 14,
  },
});

const styles = StyleSheet.create({
  testCard: {
    gap: 8,
  },
  testTitle: {
    color: theme.colors.green1000,
  },
  testDescription: {
    color: theme.colors.neutral800,
  },
  testButtonGroup: {
    marginTop: 8,
    gap: 10,
  },
  testStatus: {
    marginTop: 4,
    color: theme.colors.neutral700,
  },
});
