import { globalStyles } from "@/app/styles/globalStyles";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Image, StyleSheet, Text, View } from "react-native";
import { theme } from "../app/styles/theme";
import Button from "./Button";

interface Props {
  loading: boolean;
  onPress: () => void;
}

export default function BridgeAlertSubscribeSection({
  loading,
  onPress,
}: Props) {
  return (
    <>
      <View style={[styles.card, { paddingHorizontal: 8, paddingTop: 8 }]}>
        <Image
          source={require("../assets/images/Manchester_Ship_Canal-HD.jpg")}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.footer}>
          <Text
            style={[
              globalStyles.heading,
              globalStyles.headingBold,
              globalStyles.headingWhite,
              { paddingBottom: 16 },
            ]}
          >
            Get notified when swing bridges are closing
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons
              name="bridge"
              color={theme.colors.white}
              size={32}
            />
            <Text style={[globalStyles.body, { color: theme.colors.white }]}>
              Chester Road
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons
              name="bridge"
              color={theme.colors.white}
              size={32}
            />
            <Text style={[globalStyles.body, { color: theme.colors.white }]}>
              London Road
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <MaterialCommunityIcons
              name="bridge"
              color={theme.colors.white}
              size={32}
            />
            <Text style={[globalStyles.body, { color: theme.colors.white }]}>
              Knutsford Road
            </Text>
          </View>
          <View>
            <Text style={[globalStyles.body, { color: theme.colors.white }]}>
              You will receive a notification around 30 minutes before the swing
              bridges close, so you can plan your journey accordingly.
            </Text>
          </View>
          <Button
            variant="white"
            width="full"
            icon={
              <Feather name="bell" size={24} color={theme.colors.primary} />
            }
            onPress={onPress}
            loading={loading}
            style={{ marginTop: 24 }}
          >
            Enable notifications
          </Button>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  title: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: theme.fontSizes.largeBody,
    color: theme.colors.white,
    paddingBottom: 4,
  },
  subtitle: {
    color: theme.colors.white,
  },
  image: {
    width: "100%",
    height: 150,
    borderRadius: 12,
  },
  footer: {
    padding: 16,
  },
});
