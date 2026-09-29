import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import Button from "./Button";

type NhsDentistsCardProps = {
  onPress: () => void;
};

/** Points people at the NHS Dentists screen from the Home tab. */
export default function NhsDentistsCard({ onPress }: NhsDentistsCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Feather name="smile" size={22} color={theme.colors.primary} />
        </View>
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      </View>
      <Text style={globalStyles.cardTitle}>Looking for an NHS dentist?</Text>
      <Text style={[globalStyles.body, styles.body]}>
        See which NHS dental practices within 5 miles of Stockton Heath are
        taking on new patients, checked daily against the NHS website.
      </Text>
      <Button
        variant="primary"
        width="full"
        onPress={onPress}
        style={{ marginTop: 8 }}
      >
        See NHS dentists
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.green100,
    alignItems: "center",
    justifyContent: "center",
  },
  // The same pill as the fuel table's "LOWEST".
  newBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9,
    color: theme.colors.white,
    letterSpacing: 0.6,
  },
  body: {
    color: theme.colors.neutral800,
  },
});
