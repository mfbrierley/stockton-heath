import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";
import { Linking, ScrollView, Text, View } from "react-native";
import BackHeader from "../components/BackHeader";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";

const DATA_SOURCES: {
  icon: React.ReactNode;
  name: string;
  detail: string;
}[] = [
  {
    icon: <Feather name="cloud" size={16} color={theme.colors.green700} />,
    name: "OpenWeather",
    detail: "One Call API 3.0 - weather data",
  },
  {
    icon: <Feather name="droplet" size={16} color={theme.colors.green700} />,
    name: "Gov.uk Fuel Finder",
    detail: "UK Government API - local fuel prices",
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

const version = Constants.expoConfig?.version ?? "-";

export default function About() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.neutral200 }}>
      <BackHeader />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: 40,
        }}
      >
        <View style={{ gap: 10 }}>
          <Text style={[globalStyles.heading, globalStyles.headingBold]}>
            About the Stockton Heath App
          </Text>
          <Text style={globalStyles.largeBody}>
            A free-to-use service for the residents of Stockton Heath. The
            purpose of the app is to provide a collection of useful information
            - weather, bins, fuel prices, and bridge alerts, all in one place.
          </Text>
          <Text style={globalStyles.largeBody}>
            It&apos;s built by me, Matt - a local resident. I built it just
            because I thought it would be a good, handy thing for the community
            I live in.
          </Text>
          <Text style={globalStyles.largeBody}>
            I hope this app is useful to you. If you have any feedback,
            suggestions, or just want to say hello, please feel free to reach
            out by email at{" "}
            <Text
              style={[globalStyles.bodyBold, globalStyles.bodyLink]}
              onPress={() =>
                void Linking.openURL("mailto:stocktonheathapp@gmail.com").catch(
                  () => {},
                )
              }
            >
              stocktonheathapp@gmail.com
            </Text>
            .
          </Text>
        </View>

        {/* Data Sources */}
        <View
          style={[
            globalStyles.card,
            globalStyles.cardWhite,
            globalStyles.cardList,
          ]}
        >
          <View style={globalStyles.cardListHeader}>
            <Text
              style={[
                globalStyles.body,
                globalStyles.bodyBold,
                globalStyles.cardListHeaderText,
              ]}
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
                        globalStyles.bodySmall,
                        globalStyles.bodyMuted,
                        { marginTop: 1 },
                      ]}
                    >
                      {detail}
                    </Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={globalStyles.divider} />}
              </View>
            ))}
          </View>
        </View>

        {/* Version */}
        <Text
          style={[
            globalStyles.bodySmall,
            {
              color: theme.colors.neutral600,
              textAlign: "center",
            },
          ]}
        >
          Version {version}
        </Text>
      </ScrollView>
    </View>
  );
}
