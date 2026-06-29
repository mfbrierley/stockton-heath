import { globalStyles } from "@/app/styles/globalStyles";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Image, StyleSheet, Text, View } from "react-native";
import { theme } from "../app/styles/theme";
import Button from "./Button";

interface Props {
  notificationsEnabled: boolean | null;
  loading: boolean;
  onPress: () => void;
  onDisable: () => void;
}

export default function BridgeAlertSubscribeSection({
  notificationsEnabled,
  loading,
  onPress,
  onDisable,
}: Props) {
  const isEnabled = notificationsEnabled === true;

  const handleManage = async () => {
    onDisable();
  };

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
            Swing Bridge Alerts
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons
              name="bridge"
              color={theme.colors.neutral500}
              size={32}
            />
            <Text style={[globalStyles.body, { color: theme.colors.white }]}>
              Chester Road
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons
              name="bridge"
              color={theme.colors.neutral500}
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
              color={theme.colors.neutral500}
              size={32}
            />
            <Text style={[globalStyles.body, { color: theme.colors.white }]}>
              Knutsford Road
            </Text>
          </View>
          <View>
            <Text style={[globalStyles.body, { color: theme.colors.white }]}>
              You will receive notifications around 20 minutes before the swing
              bridges close, so you can plan your journey accordingly.
            </Text>
          </View>
          {isEnabled ? (
            <Button
              variant="whiteTransparent"
              width="full"
              icon={
                <Feather name="bell-off" size={24} color={theme.colors.white} />
              }
              onPress={() => void handleManage()}
              style={{ marginTop: 24 }}
            >
              Turn off notifications
            </Button>
          ) : (
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
          )}
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
    height: 180,
    borderRadius: 12,
  },
  footer: {
    padding: 16,
  },
});
