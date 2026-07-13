import { Ionicons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import BackHeader from "../components/BackHeader";
import Button from "../components/Button";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";

const OPENING_HOURS = [
  { label: "Monday", hours: "8:00am – 6:30pm" },
  { label: "Tuesday", hours: "8:00am – 6:30pm" },
  { label: "Wednesday", hours: "8:00am – 6:30pm" },
  { label: "Thursday", hours: "8:00am – 6:30pm" },
  { label: "Friday", hours: "8:00am – 6:30pm" },
  { label: "Saturday", hours: null },
  { label: "Sunday", hours: null },
];

const SERVICES: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  description: string;
  url: string;
}[] = [
  {
    icon: "edit",
    label: "eConsult",
    description:
      "Fill in an online form to get advice and treatment from the surgery",
    url: "https://strettonmedicalcentre.webgp.com/",
  },
  {
    icon: "calendar",
    label: "Appointments",
    description: "Book and manage appointments with your doctor",
    url: "https://www.strettonmedicalcentre.co.uk/appointments",
  },
  {
    icon: "clipboard",
    label: "Repeat Prescriptions",
    description: "Request a repeat prescription online",
    url: "https://www.strettonmedicalcentre.co.uk/prescriptions",
  },
  {
    icon: "bar-chart-2",
    label: "Test Results",
    description: "View results of tests and investigations",
    url: "https://www.strettonmedicalcentre.co.uk/test-results",
  },
  {
    icon: "user-plus",
    label: "Register as a Patient",
    description: "New to the area? Register with the practice",
    url: "https://www.strettonmedicalcentre.co.uk/new-patients",
  },
];

export default function StrettonMedicalCentre() {
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
            Stretton{"\n"}Medical Centre
          </Text>
          <Text
            style={[
              globalStyles.body,
              globalStyles.bodyMuted,
              { marginTop: 6 },
            ]}
          >
            5 Hatton Lane, Stretton, Warrington. WA4 4NE
          </Text>
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
              onPress={() => Linking.openURL("tel:01925599856")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
              }}
            >
              <Feather name="phone" size={16} color={theme.colors.green800} />
              <Text style={[globalStyles.body, globalStyles.bodyLink]}>
                01925 599856
              </Text>
            </Pressable>
            <View style={globalStyles.divider} />
            <Pressable
              onPress={() =>
                Linking.openURL("mailto:cmicb-war.strettonmc@nhs.net")
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
              }}
            >
              <Feather name="mail" size={16} color={theme.colors.green800} />
              <View style={{ flex: 1 }}>
                <Text style={[globalStyles.body, globalStyles.bodyLink]}>
                  cmicb-war.strettonmc@nhs.net
                </Text>
                <Text
                  style={[
                    globalStyles.bodySmall,
                    globalStyles.bodyMuted,
                    { marginTop: 1 },
                  ]}
                >
                  Not for medical queries or appointments
                </Text>
              </View>
            </Pressable>
            <View style={globalStyles.divider} />
            <Pressable
              onPress={() => Linking.openURL("tel:111")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
              }}
            >
              <Feather name="moon" size={16} color={theme.colors.neutral700} />
              <View style={{ flex: 1 }}>
                <Text style={[globalStyles.body, globalStyles.bodyLink]}>
                  111
                </Text>
                <Text
                  style={[
                    globalStyles.bodySmall,
                    globalStyles.bodyMuted,
                    { marginTop: 1 },
                  ]}
                >
                  Out of hours
                </Text>
              </View>
            </Pressable>
          </View>
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
                  {hours ? (
                    <Text style={[globalStyles.body, globalStyles.bodyBold]}>
                      {hours}
                    </Text>
                  ) : (
                    <Text
                      style={[
                        globalStyles.body,
                        globalStyles.bodyBold,
                        { color: theme.colors.statusRed },
                      ]}
                    >
                      Closed
                    </Text>
                  )}
                </View>
                {i < arr.length - 1 && <View style={globalStyles.divider} />}
              </View>
            ))}
          </View>
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              alignItems: "flex-start",
              backgroundColor: "#FEF3C7",
              paddingHorizontal: 24,
              paddingVertical: 14,
            }}
          >
            <Ionicons
              name="information-circle"
              size={16}
              color={theme.colors.statusAmber}
              style={{ marginTop: 1 }}
            />
            <Text style={[globalStyles.body, { flex: 1, fontSize: 13 }]}>
              When the surgery is closed, call 111 for out-of-hours medical
              advice.
            </Text>
          </View>
        </View>

        {/* Online Services */}
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
              Online Services
            </Text>
          </View>
          <View style={{ paddingHorizontal: 24, paddingVertical: 8 }}>
            {SERVICES.map(({ icon, label, description, url }, i, arr) => (
              <View key={label}>
                <Pressable
                  onPress={() => Linking.openURL(url)}
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
                  </View>
                  <Feather
                    name="chevron-right"
                    size={16}
                    color={theme.colors.neutral600}
                    style={{ marginTop: 9 }}
                  />
                </Pressable>
                {i < arr.length - 1 && <View style={globalStyles.divider} />}
              </View>
            ))}
          </View>
        </View>

        <Button
          variant="primary"
          width="full"
          onPress={() =>
            Linking.openURL("https://www.strettonmedicalcentre.co.uk/")
          }
        >
          Find out more at strettonmedicalcentre.co.uk
        </Button>
      </ScrollView>
    </View>
  );
}
