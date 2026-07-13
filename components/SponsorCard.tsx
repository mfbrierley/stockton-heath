import Feather from "@expo/vector-icons/Feather";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import RowswoodLogo from "../assets/images/Rowswood-Timber-Logo.svg";

export default function SponsorCard() {
  return (
    <View style={styles.card}>
      <Text style={[globalStyles.cardTitle, styles.title]}>
        About our sponsor
      </Text>
      <RowswoodLogo width={160} height={40} style={styles.logo} />
      <Text style={[globalStyles.body, styles.body]}>
        Rowswood Timber have been supplying quality landscaping products to the
        residents of Stockton Heath for over 50 years.
      </Text>
      <View style={styles.locationRow}>
        <Feather name="map-pin" size={13} color={theme.colors.neutral700} />
        <Text style={[globalStyles.body, styles.location]}>
          Hatton Lane, Hatton, Warrington
        </Text>
      </View>
      <Pressable
        onPress={() => Linking.openURL("https://www.rowswoodtimber.com")}
      >
        <View style={styles.linkRow}>
          <Text style={[globalStyles.body, styles.link]}>
            rowswoodtimber.com
          </Text>
          <Feather
            name="external-link"
            size={14}
            color={theme.colors.green700}
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  title: {
    color: theme.colors.green1000,
  },
  logo: {
    marginVertical: 4,
  },
  body: {
    color: theme.colors.neutral800,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  link: {
    color: theme.colors.green700,
    paddingRight: 8,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  location: {
    color: theme.colors.neutral800,
  },
});
