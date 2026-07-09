import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import Button from "./Button";

type BridgeAlertsCardProps = {
  onPress: () => void;
};

export default function BridgeAlertsCard({ onPress }: BridgeAlertsCardProps) {
  return (
    <View style={styles.card}>
      <Image
        source={require("../assets/images/Manchester_Ship_Canal-HD.jpg")}
        style={styles.bridgeImage}
        contentFit="cover"
      />
      <Text style={globalStyles.cardTitle}>
        Stay ahead of swing bridge closures
      </Text>
      <Text style={[globalStyles.body, styles.body]}>
        Turn on alerts and get notified as soon as a swing bridge alert is
        posted.
      </Text>
      <Button
        variant="primary"
        width="full"
        onPress={onPress}
        style={{ marginTop: 8 }}
      >
        Get swing bridge alerts
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  body: {
    color: theme.colors.neutral800,
  },
  bridgeImage: {
    width: "100%",
    height: 132,
    borderRadius: 12,
  },
});
