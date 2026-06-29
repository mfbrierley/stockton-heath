import { Ionicons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";

const FEATURES: {
  icon: React.ReactNode;
  tab: string;
  description: string;
}[] = [
  {
    icon: <Feather name="sun" size={18} color={theme.colors.green800} />,
    tab: "Home",
    description:
      "Current weather for Stockton Heath and live fuel prices at three local petrol stations.",
  },
  {
    icon: <Feather name="trash-2" size={18} color={theme.colors.green800} />,
    tab: "Services",
    description:
      "Bin collection schedule for your address, plus info on the recycling centre, Broomfields Leisure Centre, the medical centre, and the post office.",
  },
  {
    icon: (
      <Feather name="alert-triangle" size={18} color={theme.colors.green800} />
    ),
    tab: "Bridge",
    description:
      "Live swing bridge closure alerts with optional push notifications so you're never caught off guard.",
  },
];

const DATA_SOURCES: {
  icon: React.ReactNode;
  name: string;
  detail: string;
}[] = [
  {
    icon: <Feather name="cloud" size={16} color={theme.colors.green700} />,
    name: "OpenWeather",
    detail: "One Call API 3.0 — weather data",
  },
  {
    icon: <Feather name="droplet" size={16} color={theme.colors.green700} />,
    name: "Gov.uk Fuel Finder",
    detail: "UK Government API — local fuel prices",
  },
  {
    icon: <Feather name="twitter" size={16} color={theme.colors.green700} />,
    name: "twitterapi.io / @trafficwarr",
    detail: "Bridge closure alerts via Twitter",
  },
  {
    icon: <Feather name="map-pin" size={16} color={theme.colors.green700} />,
    name: "Warrington Borough Council",
    detail: "Bin collection lookup API",
  },
];

const version = Constants.expoConfig?.version ?? "—";

export default function About() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.neutral200 }}
      contentContainerStyle={{
        padding: 16,
        gap: 16,
        paddingBottom: 40,
        paddingTop: insets.top + 8,
      }}
    >
      <Pressable
        onPress={() => router.back()}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 4,
          alignSelf: "flex-start",
        }}
      >
        <Ionicons name="chevron-back" size={18} color={theme.colors.green800} />
        <Text
          style={[
            globalStyles.body,
            globalStyles.bodyBold,
            { color: theme.colors.green800 },
          ]}
        >
          Back
        </Text>
      </Pressable>

      <View style={{ gap: 10 }}>
        <Text style={[globalStyles.heading, globalStyles.headingBold]}>
          About the Stockton Heath App
        </Text>
        <Text style={[globalStyles.body, { color: theme.colors.neutral1000 }]}>
          It&apos;s a free-to-use service for residents of Stockton Heath. The
          purpose of the app is to provide a collection of useful information -
          weather, bins, fuel prices, and bridge alerts, all in one place.
        </Text>
        <Text style={[globalStyles.body, { color: theme.colors.neutral1000 }]}>
          It&apos;s built by me, Matt — a local resident. I built it just
          because I thought it would be a good, handy thing for the community I
          live in. I hope this app is useful to you. If you have any feedback,
          suggestions, or just want to say hello, please feel free to reach out
          by email at stocktonheathapp@gmail.com.
        </Text>
      </View>

      {/* Data Sources */}
      <View
        style={[
          globalStyles.card,
          globalStyles.cardWhite,
          { padding: 0, overflow: "hidden" },
        ]}
      >
        <View
          style={{
            backgroundColor: theme.colors.neutral300,
            paddingHorizontal: 24,
            paddingVertical: 14,
          }}
        >
          <Text
            style={[globalStyles.body, globalStyles.bodyBold, { fontSize: 15 }]}
          >
            Data Sources
          </Text>
        </View>
        <View style={{ paddingHorizontal: 24, paddingVertical: 12, gap: 0 }}>
          {DATA_SOURCES.map(({ icon, name, detail }, i, arr) => (
            <View key={name}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  paddingVertical: 12,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: theme.colors.green100,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[globalStyles.body, globalStyles.bodyBold]}>
                    {name}
                  </Text>
                  <Text
                    style={[
                      globalStyles.body,
                      {
                        color: theme.colors.neutral700,
                        fontSize: 14,
                        marginTop: 1,
                      },
                    ]}
                  >
                    {detail}
                  </Text>
                </View>
              </View>
              {i < arr.length - 1 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: theme.colors.neutral300,
                  }}
                />
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Version */}
      <Text
        style={[
          globalStyles.body,
          {
            color: theme.colors.neutral600,
            textAlign: "center",
            fontSize: 14,
          },
        ]}
      >
        Version {version}
      </Text>
    </ScrollView>
  );
}
