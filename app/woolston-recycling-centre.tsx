import { Ionicons } from "@expo/vector-icons";
import { Linking, ScrollView, Text, View } from "react-native";
import BackHeader from "../components/BackHeader";
import Button from "../components/Button";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";

const ACCEPTED_ITEMS = [
  "Aluminium foil",
  "Batteries – car, leisure and household",
  "Bicycles",
  "Bric-a-brac",
  "Books",
  "Cans – aluminium and steel",
  "Cardboard",
  "Carpet",
  "CDs, DVDs, videotapes",
  "Cooking oil",
  "Ferrous metal",
  "Fluorescent tubes",
  "Glass – amber, clear, green",
  "Grass / garden waste",
  "Hardcore / rubble",
  "Ink cartridges",
  "Mattresses",
  "Mineral oil",
  "Mobile phones",
  "Non-ferrous metal",
  "Other white goods",
  "Paint",
  "Paper – normal and shredded",
  "PC and associated hardware",
  "Plastic bags",
  "Plastic bottles – mixed",
  "Plasterboard",
  "Polystyrene",
  "Rigid plastic",
  "Sofas",
  "Shoes",
  "Small electrical items – such as radios, DVD and video players, toasters, vacuum cleaners, etc",
  "Spectacles",
  "Textiles",
  "TVs and PC monitors",
  "Video tapes",
  "Washing machines, tumble dryers, dishwashers",
  "Wood / timber",
];

const NOT_ACCEPTED_ITEMS = [
  "Car tyres / wheels and other vehicle parts",
  "Fire extinguishers",
  "Fridges and freezers",
  "Gas bottles including butane, propane, camping gas and oxygen cylinders",
  "Hazardous or inflammable liquids and chemicals",
  "Pallets",
];

const PERMIT_ITEMS = [
  "Rubble, bricks, paving stones, wall and floor tiles, roof tiles",
  "Fencing, sheds, decking, concrete posts and panels",
  "Plaster / plasterboard",
  "Cement",
  "Asbestos",
  "Kitchen units",
  "Bathroom suites",
  "Doors and window frames",
  "Fireplaces, radiators and central heating boilers",
  "Gutters, downpipes, fascias",
  "Loft insulation",
];

type SectionConfig = {
  title: string;
  items: string[];
  icon: "checkmark-circle" | "close-circle" | "alert-circle";
  iconColor: string;
  iconBg: string;
  cardBg: string;
  headerBg: string;
  headerText: string;
};

const SECTIONS: SectionConfig[] = [
  {
    title: "Accepted Items",
    items: ACCEPTED_ITEMS,
    icon: "checkmark-circle",
    iconColor: theme.colors.statusGreen,
    iconBg: "#DCFCE7",
    cardBg: theme.colors.white,
    headerBg: "#DCFCE7",
    headerText: theme.colors.statusGreen,
  },
  {
    title: "Prohibited Items",
    items: NOT_ACCEPTED_ITEMS,
    icon: "close-circle",
    iconColor: theme.colors.statusRed,
    iconBg: "#FEE2E2",
    cardBg: theme.colors.white,
    headerBg: "#FEE2E2",
    headerText: theme.colors.statusRed,
  },
  {
    title: "Items you may need a permit for",
    items: PERMIT_ITEMS,
    icon: "alert-circle",
    iconColor: theme.colors.statusAmber,
    iconBg: "#FEF3C7",
    cardBg: theme.colors.white,
    headerBg: "#FEF3C7",
    headerText: theme.colors.statusAmber,
  },
];

function ItemRow({
  label,
  icon,
  iconColor,
}: {
  label: string;
  icon: SectionConfig["icon"];
  iconColor: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        paddingVertical: 8,
      }}
    >
      <Ionicons
        name={icon}
        size={18}
        color={iconColor}
        style={{ marginTop: 2 }}
      />
      <Text style={[globalStyles.body, { flex: 1 }]}>{label}</Text>
    </View>
  );
}

function Section({ config }: { config: SectionConfig }) {
  return (
    <View
      style={[globalStyles.card, globalStyles.cardWhite, globalStyles.cardList]}
    >
      <View
        style={{
          backgroundColor: config.headerBg,
          paddingHorizontal: 24,
          paddingVertical: 14,
        }}
      >
        <Text
          style={[
            globalStyles.body,
            globalStyles.bodyBold,
            { color: config.headerText, fontSize: 15 },
          ]}
        >
          {config.title}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 24, paddingVertical: 8 }}>
        {config.items.map((item, index) => (
          <View key={item}>
            <ItemRow
              label={item}
              icon={config.icon}
              iconColor={config.iconColor}
            />
            {index < config.items.length - 1 && (
              <View style={[globalStyles.divider, { marginLeft: 28 }]} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function WoolstonRecyclingCentre() {
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
            Woolston{"\n"}Community Recycling Centre
          </Text>
          <Text
            style={[
              globalStyles.body,
              globalStyles.bodyMuted,
              { marginTop: 6 },
            ]}
          >
            New Cut Lane, WA1 4AG
          </Text>
        </View>

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
              Opening hours
            </Text>
          </View>
          <View style={{ paddingHorizontal: 24, paddingVertical: 12, gap: 8 }}>
            {[
              { label: "Monday – Friday", hours: "10am – 4pm" },
              { label: "Weekends & bank holidays", hours: "8am – 6pm" },
            ].map(({ label, hours }, i, arr) => (
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
              Closed on Christmas Day, Boxing Day and New Year&apos;s Day.
            </Text>
          </View>
        </View>

        {SECTIONS.map((section) => (
          <Section key={section.title} config={section} />
        ))}

        <View
          style={[
            globalStyles.card,
            {
              backgroundColor: "#FEF3C7",
              padding: 20,
              flexDirection: "row",
              gap: 12,
              alignItems: "flex-start",
            },
          ]}
        >
          <Ionicons
            name="information-circle"
            size={20}
            color={theme.colors.statusAmber}
            style={{ marginTop: 1 }}
          />
          <Text style={[globalStyles.body, { flex: 1, fontSize: 14 }]}>
            Items in the permit section are not considered household waste, so
            there are limits on how much you can bring to the recycling centre.
          </Text>
        </View>

        <Button
          variant="primary"
          width="full"
          onPress={() =>
            Linking.openURL(
              "https://www.warrington.gov.uk/woolston-community-recycling-centre",
            )
          }
        >
          More info on warrington.gov.uk
        </Button>
      </ScrollView>
    </View>
  );
}
