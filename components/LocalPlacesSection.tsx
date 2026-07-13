import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import QuickLinkCard from "./QuickLinkCard";

export default function LocalPlacesSection() {
  return (
    <View style={{ gap: 16 }}>
      <Text style={globalStyles.heading}>Local Services</Text>
      <QuickLinkCard
        icon={
          <Feather name="activity" size={22} color={theme.colors.primary} />
        }
        title="Broomfields Leisure Centre"
        onPress={() => router.push("/broomfields-leisure-centre")}
      />
      <QuickLinkCard
        icon={<Feather name="mail" size={22} color={theme.colors.primary} />}
        title="Post Office"
        onPress={() => router.push("/post-office")}
      />
      <QuickLinkCard
        icon={<Feather name="heart" size={22} color={theme.colors.primary} />}
        title="Medical Centres"
        onPress={() => router.push("/medical-centres")}
      />
    </View>
  );
}
