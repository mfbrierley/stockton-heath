import { StyleSheet, Text, View } from "react-native";
import { theme } from "../app/styles/theme";
import RowswoodLogo from "../assets/images/Rowswood-Timber-Logo.svg";

export default function SponsorBadge() {
  return (
    <View style={styles.container}>
      <Text style={styles.sponsoredBy}>sponsored by</Text>
      <RowswoodLogo width={162} height={54} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: "100%",
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    paddingVertical: 0,
    paddingHorizontal: 12,
  },
  sponsoredBy: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.neutral1000,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
