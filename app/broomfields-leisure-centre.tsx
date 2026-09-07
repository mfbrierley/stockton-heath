import Feather from "@expo/vector-icons/Feather";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BackHeader from "../components/BackHeader";
import SourceNote from "../components/SourceNote";
import Button from "../components/Button";
import { MANUAL_SOURCE_LABEL, BROOMFIELDS_URL } from "../utils/dataSources";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";

const OPENING_HOURS = [
  { label: "Mon – Thu", hours: "6:00am – 10:00pm" },
  { label: "Friday", hours: "6:00am – 6:00pm" },
  { label: "Saturday", hours: "7:30am – 5:00pm" },
  { label: "Sunday", hours: "7:30am – 5:00pm" },
];

const FACILITIES: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  description: string;
  /** Shown when LiveWire has posted a closure notice for this facility. */
  notice?: string;
}[] = [
  {
    icon: "activity",
    label: "Gym",
    description: "Modern cardio and strength equipment for all abilities",
  },
  {
    icon: "users",
    label: "Group Exercise Classes",
    description: "Over 20 sessions each week",
  },
  {
    icon: "droplet",
    label: "Swimming Pool",
    description: "For fitness, lessons and family swims",
    notice: "Closed until further notice",
  },
  {
    icon: "user",
    label: "Personal Training",
    description: "One-to-one support to help you reach your goals",
  },
  {
    icon: "flag",
    label: "Football Pitches",
    description: "Outdoor facilities for casual play or team training",
  },
  {
    icon: "calendar",
    label: "Venue Hire",
    description: "Spaces available for events, clubs and community activities",
  },
];

export default function BroomfieldsLeisureCentre() {
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
        <View>
          <Text style={[globalStyles.heading, globalStyles.headingBold]}>
            Broomfields{"\n"}Leisure Centre
          </Text>
          <Text
            style={[
              globalStyles.body,
              globalStyles.bodyMuted,
              { marginTop: 6 },
            ]}
          >
            Broomfields Road, Appleton, Warrington. WA4 3AE
          </Text>
        </View>

        {/* Opening Hours */}
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
              Opening Hours
            </Text>
          </View>
          <View style={{ paddingHorizontal: 24, paddingVertical: 12, gap: 8 }}>
            {OPENING_HOURS.map(({ label, hours }, i, arr) => (
              <View key={label}>
                <View
                  style={[globalStyles.rowSpaceBetween, { paddingVertical: 6 }]}
                >
                  <Text style={globalStyles.body}>{label}</Text>
                  <Text style={[globalStyles.body, globalStyles.bodyBold]}>
                    {hours}
                  </Text>
                </View>
                {i < arr.length - 1 && <View style={globalStyles.divider} />}
              </View>
            ))}
          </View>
        </View>

        {/* Facilities */}
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
              Facilities
            </Text>
          </View>
          <View style={{ paddingHorizontal: 24, paddingVertical: 8 }}>
            {FACILITIES.map(({ icon, label, description, notice }, i, arr) => (
              <View key={label}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 12,
                    paddingVertical: 12,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      backgroundColor: theme.colors.neutral200,
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Feather
                      name={icon}
                      size={16}
                      color={theme.colors.green800}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[globalStyles.body, globalStyles.bodyBold]}>
                      {label}
                    </Text>
                    <Text
                      style={[
                        globalStyles.bodySmall,
                        globalStyles.bodyMuted,
                        { marginTop: 2 },
                      ]}
                    >
                      {description}
                    </Text>
                    {notice ? (
                      <View style={styles.noticeRow}>
                        <Feather
                          name="alert-circle"
                          size={13}
                          color={theme.colors.statusRed}
                        />
                        <Text
                          style={[globalStyles.bodySmall, styles.noticeText]}
                        >
                          {notice}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                {i < arr.length - 1 && <View style={globalStyles.divider} />}
              </View>
            ))}
          </View>
        </View>

        {/* Contact */}
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
              Contact
            </Text>
          </View>
          <View style={{ paddingHorizontal: 24, paddingVertical: 8 }}>
            <Pressable
              onPress={() => Linking.openURL("tel:01925268768")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
              }}
            >
              <Feather name="phone" size={16} color={theme.colors.green800} />
              <Text style={[globalStyles.body, globalStyles.bodyLink]}>
                01925 268768
              </Text>
            </Pressable>
            <View style={globalStyles.divider} />
            <Pressable
              onPress={() =>
                Linking.openURL(
                  "mailto:broomfields_reception@livewirewarrington.org",
                )
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
              }}
            >
              <Feather name="mail" size={16} color={theme.colors.green800} />
              <Text
                style={[globalStyles.body, globalStyles.bodyLink, { flex: 1 }]}
              >
                broomfields_reception@livewirewarrington.org
              </Text>
            </Pressable>
          </View>
        </View>

        <SourceNote label={MANUAL_SOURCE_LABEL} url={BROOMFIELDS_URL} />

        <Button
          variant="primary"
          width="full"
          onPress={() => Linking.openURL(BROOMFIELDS_URL)}
        >
          Find out more at livewirewarrington.co.uk
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  noticeText: {
    color: theme.colors.statusRed,
    fontFamily: theme.fonts.bodyBold,
  },
});
