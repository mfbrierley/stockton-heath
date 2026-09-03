import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import Button from "./Button";

type DiscountsCardProps = {
  onPress: () => void;
};

export default function DiscountsCard({ onPress }: DiscountsCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Feather name="tag" size={24} color={theme.colors.green800} />
      </View>
      <Text style={globalStyles.cardTitle}>Save at local businesses</Text>
      <Text style={[globalStyles.body, styles.body]}>
        Businesses around the village offer discounts to people with the app.
      </Text>
      <Button
        variant="primary"
        width="full"
        onPress={onPress}
        style={{ marginTop: 8 }}
      >
        See local discounts
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.green100,
  },
  body: {
    color: theme.colors.neutral800,
  },
});
