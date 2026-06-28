import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import { WeatherApiResponse } from "./WeatherSection";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

type GreetingCardProps = {
  data: WeatherApiResponse | null;
  windMph: number | undefined;
};

function isSunny(code: number): boolean {
  return code === 800 || code === 801;
}

function isCloudy(code: number): boolean {
  return code >= 802 && code <= 804;
}

function isRainy(code: number): boolean {
  return (code >= 301 && code <= 321) || (code >= 502 && code <= 531);
}

function getDayDescription(
  temp?: number,
  weatherCode?: number,
  windMph?: number,
): string {
  if (temp !== undefined && temp < 1) {
    return "It's freezing today, take extra care.";
  }

  if (temp !== undefined && temp < 5) {
    return "It's cold today, wrap up warm.";
  }

  if (windMph !== undefined && windMph > 20) {
    return "It's windy today, take care.";
  }

  if (weatherCode !== undefined && isRainy(weatherCode)) {
    return "It's a rainy day in the village.";
  }

  if (
    temp !== undefined &&
    temp > 10 &&
    weatherCode !== undefined &&
    isSunny(weatherCode)
  ) {
    return "Enjoy the sunshine today!";
  }

  if (
    temp !== undefined &&
    temp > 10 &&
    weatherCode !== undefined &&
    isCloudy(weatherCode)
  ) {
    return "It's a warm day in the village.";
  }

  if (weatherCode !== undefined && isCloudy(weatherCode)) {
    return "It's a mild day in the village.";
  }

  return "Have a great day in the village.";
}

export function GreetingCard({ data, windMph }: GreetingCardProps) {
  const weatherCode = data?.current.weather?.[0]?.id;

  const dayDescription = getDayDescription(
    data?.current.temp,
    weatherCode,
    windMph,
  );

  const isEvening = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 5 || hour >= 20;
  }, []);

  return (
    <View style={{ marginTop: -64 }}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.green800]}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={[globalStyles.card, { paddingTop: 24 }]}
      >
        <Text
          style={[
            globalStyles.heading,
            globalStyles.headingBold,
            globalStyles.headingWhite,
            { fontSize: 36, lineHeight: 58 },
          ]}
        >
          {getGreeting()}
        </Text>
        {!isEvening && (
          <Text
            style={[
              globalStyles.body,
              {
                color: theme.colors.green300,
                fontSize: 18,
                lineHeight: 28,
                marginTop: 4,
              },
            ]}
          >
            {dayDescription}
          </Text>
        )}
      </LinearGradient>
    </View>
  );
}
