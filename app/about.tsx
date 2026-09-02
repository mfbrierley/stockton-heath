import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import BackHeader from "../components/BackHeader";
import { DATA_SOURCES, displayUrl } from "../utils/dataSources";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";

const version = Constants.expoConfig?.version ?? "-";

function openUrl(url: string) {
  void Linking.openURL(url).catch(() => {});
}

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
            I hope this app is useful to you. If you have any feedback,
            suggestions, or just want to say hello, please feel free to reach
            out by email at{" "}
            <Text
              style={[globalStyles.bodyBold, globalStyles.bodyLink]}
              onPress={() => openUrl("mailto:stocktonheathapp@gmail.com")}
            >
              stocktonheathapp@gmail.com
            </Text>
            .
          </Text>
        </View>

        {/* Not an official council app - say so plainly, before anything else */}
        <View style={styles.disclaimerCard}>
          <View style={styles.disclaimerHeader}>
            <Feather name="info" size={16} color={theme.colors.green800} />
            <Text style={[globalStyles.body, globalStyles.bodyBold]}>
              An unofficial community app
            </Text>
          </View>
          <Text style={[globalStyles.bodySmall, styles.disclaimerBody]}>
            This app is not affiliated with, endorsed by, or connected to
            Warrington Borough Council, the UK Government, or any other public
            body. It is an independent app built by someone who lives here.
          </Text>
          <Text style={[globalStyles.bodySmall, styles.disclaimerBody]}>
            It only reads publicly available information and shows it to you -
            it cannot change anything the council holds, and it is not a way to
            contact them. For anything official, or to report a missed
            collection, go to the council directly at{" "}
            <Text
              style={styles.disclaimerLink}
              accessibilityRole="link"
              onPress={() => openUrl("https://www.warrington.gov.uk")}
            >
              warrington.gov.uk
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
              Where the information comes from
            </Text>
          </View>
          <View style={{ paddingHorizontal: 24, paddingVertical: 12, gap: 0 }}>
            {DATA_SOURCES.map(
              ({ icon, name, detail, url, government }, i, arr) => (
                <View key={name}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <View style={styles.sourceIcon}>
                      <Feather
                        name={icon as never}
                        size={16}
                        color={theme.colors.green700}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.sourceNameRow}>
                        <Text
                          style={[globalStyles.body, globalStyles.bodyBold]}
                        >
                          {name}
                        </Text>
                        {government && (
                          <View style={styles.govBadge}>
                            <Text style={styles.govBadgeText}>
                              GOVERNMENT SOURCE
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          globalStyles.bodySmall,
                          globalStyles.bodyMuted,
                          { marginTop: 1 },
                        ]}
                      >
                        {detail}
                      </Text>
                      <Text
                        style={styles.sourceLink}
                        accessibilityRole="link"
                        onPress={() => openUrl(url)}
                      >
                        {displayUrl(url)}
                      </Text>
                    </View>
                  </View>
                  {i < arr.length - 1 && <View style={globalStyles.divider} />}
                </View>
              ),
            )}
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

const styles = StyleSheet.create({
  disclaimerCard: {
    backgroundColor: theme.colors.green100,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.green700,
    padding: 20,
    gap: 8,
  },
  disclaimerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  disclaimerBody: {
    color: theme.colors.neutral1000,
  },
  disclaimerLink: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.green800,
    textDecorationLine: "underline",
  },
  sourceIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.green100,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sourceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  govBadge: {
    backgroundColor: theme.colors.green100,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  govBadgeText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9,
    color: theme.colors.green800,
    letterSpacing: 0.6,
  },
  sourceLink: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 4,
    color: theme.colors.green800,
    textDecorationLine: "underline",
  },
});
