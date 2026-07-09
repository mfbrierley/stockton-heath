import { MaterialCommunityIcons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import { Linking, ScrollView, Text, View } from "react-native";
import BackHeader from "../components/BackHeader";
import Button from "../components/Button";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";

const OPENING_HOURS = [
  { label: "Monday", hours: "7:30am – 5:30pm" },
  { label: "Tuesday", hours: "7:30am – 5:30pm" },
  { label: "Wednesday", hours: "7:30am – 5:30pm" },
  { label: "Thursday", hours: "7:30am – 5:30pm" },
  { label: "Friday", hours: "7:30am – 5:30pm" },
  { label: "Saturday", hours: "7:30am – 2:00pm" },
  { label: "Sunday", hours: null },
];

const SERVICES: {
  icon: React.ReactNode;
  category: string;
  items: string[];
}[] = [
  {
    icon: (
      <Feather name="credit-card" size={16} color={theme.colors.green800} />
    ),
    category: "Everyday Personal & Business Banking",
    items: ["Cash Withdrawals", "Cash Deposits", "Cheque Deposits"],
  },
  {
    icon: <Feather name="package" size={16} color={theme.colors.green800} />,
    category: "Mails",
    items: [
      "Drop & Go",
      "Parcelforce Express 48 Large",
      "DPD – Buy in branch",
      "DPD – Drop off and collections",
    ],
  },
  {
    icon: <Feather name="file-text" size={16} color={theme.colors.green800} />,
    category: "Pay Bills and Top Up",
    items: ["Pay Bills and Top Up"],
  },
  {
    icon: <Feather name="book" size={16} color={theme.colors.green800} />,
    category: "Passport Applications",
    items: ["Paper Check & Send – New & Renewals"],
  },
  {
    icon: <Feather name="shield" size={16} color={theme.colors.green800} />,
    category: "Identity Services",
    items: ["Document Certification Service"],
  },
  {
    icon: <Feather name="truck" size={16} color={theme.colors.green800} />,
    category: "Driving",
    items: ["Vehicle Tax"],
  },
  {
    icon: <Feather name="globe" size={16} color={theme.colors.green800} />,
    category: "Travel",
    items: ["Foreign Currency", "Travel Insurance", "Travel Money Card"],
  },
  {
    icon: (
      <MaterialCommunityIcons
        name="currency-gbp"
        size={16}
        color={theme.colors.green800}
      />
    ),
    category: "Your Finances",
    items: [
      "Savings application forms",
      "Savings Account ID Verification (free)",
    ],
  },
];

export default function PostOffice() {
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
            Stockton Heath{"\n"}Post Office
          </Text>
          <Text
            style={[
              globalStyles.body,
              globalStyles.bodyMuted,
              { marginTop: 6 },
            ]}
          >
            49 Walton Road, Stockton Heath, Warrington. WA4 6NW
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
        </View>

        {/* Services */}
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
              Services
            </Text>
            <Text
              style={[
                globalStyles.body,
                globalStyles.bodyBold,
                { fontSize: 15 },
              ]}
            >
              Services
            </Text>
          </View>
          <View style={{ paddingHorizontal: 24, paddingVertical: 8 }}>
            {SERVICES.map(({ icon, category, items }, i, arr) => (
              <View key={category}>
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
                    {icon}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[globalStyles.body, globalStyles.bodyBold]}>
                      {category}
                    </Text>
                    {items.map((item) => (
                      <Text
                        key={item}
                        style={[
                          globalStyles.bodySmall,
                          globalStyles.bodyMuted,
                          { marginTop: 2 },
                        ]}
                      >
                        {item}
                      </Text>
                    ))}
                  </View>
                </View>
                {i < arr.length - 1 && <View style={globalStyles.divider} />}
              </View>
            ))}
          </View>
        </View>

        <Button
          variant="primary"
          width="full"
          onPress={() =>
            Linking.openURL(
              "https://www.postoffice.co.uk/branch-finder/3194345/stockton-heath",
            )
          }
        >
          Find out more at postoffice.co.uk
        </Button>
      </ScrollView>
    </View>
  );
}
