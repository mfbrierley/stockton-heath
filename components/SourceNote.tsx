import { globalStyles } from "@/app/styles/globalStyles";
import { theme } from "@/app/styles/theme";
import { displayUrl } from "@/utils/dataSources";
import { Linking, StyleSheet, Text } from "react-native";

/**
 * A one-line "where this came from" note, shown under data the app has not
 * produced itself. The address is spelled out rather than hidden behind a word
 * so it can be read as well as tapped.
 */
export default function SourceNote({
  label,
  url,
}: {
  label: string;
  url: string;
}) {
  return (
    <Text style={[globalStyles.bodySmall, styles.text]}>
      {label}{" "}
      <Text
        style={styles.link}
        accessibilityRole="link"
        onPress={() => void Linking.openURL(url).catch(() => {})}
      >
        {displayUrl(url)}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.neutral700,
  },
  link: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.green800,
    textDecorationLine: "underline",
  },
});
