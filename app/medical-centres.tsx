import Feather from "@expo/vector-icons/Feather";
import { Href, router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import BackHeader from "../components/BackHeader";
import QuickLinkCard from "../components/QuickLinkCard";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";

const CENTRES: { title: string; route: Href }[] = [
  {
    title: "Stockton Heath Medical Centre",
    route: "/stockton-heath-medical-centre",
  },
  { title: "Latchford Medical Centre", route: "/latchford-medical-centre" },
  { title: "Stretton Medical Centre", route: "/stretton-medical-centre" },
];

export default function MedicalCentres() {
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
            Medical Centres
          </Text>
          <Text
            style={[
              globalStyles.body,
              globalStyles.bodyMuted,
              { marginTop: 6 },
            ]}
          >
            Local GP practices in and around Stockton Heath
          </Text>
        </View>

        {CENTRES.map(({ title, route }) => (
          <QuickLinkCard
            key={title}
            icon={
              <Feather name="heart" size={22} color={theme.colors.primary} />
            }
            title={title}
            onPress={() => router.push(route)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
