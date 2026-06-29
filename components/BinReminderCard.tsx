import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import Button from "./Button";

type BinReminderCardProps = {
  onPress: () => void;
};

export default function BinReminderCard({ onPress }: BinReminderCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Feather name="trash-2" size={24} color={theme.colors.green800} />
      </View>
      <Text style={globalStyles.cardTitle}>Never miss bin day</Text>
      <Text style={[globalStyles.body, styles.body]}>
        Get reminders for your bin collection so you are always ready.
      </Text>
      <Button variant="primary" width="full" onPress={onPress}>
        Set up bin reminders
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
