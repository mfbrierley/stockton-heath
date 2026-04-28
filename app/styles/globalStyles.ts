import { StyleSheet } from "react-native";
import { theme } from "./theme";

export const globalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.neutral200,
  },
  card: {
    padding: 32,
    borderRadius: 24,
  },
  cardPrimary: {},
  cardSecondary: {
    backgroundColor: theme.colors.secondary,
  },
  cardTertiary: {
    backgroundColor: theme.colors.tertiary,
  },
  cardWhite: {
    backgroundColor: theme.colors.white,
  },
  heading: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.heading,
    fontWeight: theme.fontWeights.regular,
    color: theme.colors.green1000,
  },
  headingWhite: {
    color: theme.colors.white,
  },
  headingBold: {
    fontFamily: "NotoSerifBold",
  },
  headingNeutral: {
    color: theme.colors.neutral200,
  },
  headingNeutralDark: {
    color: theme.colors.neutralDark,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.body,
    lineHeight: 22,
    fontWeight: theme.fontWeights.regular,
    color: theme.colors.neutral1000,
  },
  largeBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.largeBody,
    lineHeight: 28,
    fontWeight: theme.fontWeights.regular,
    color: theme.colors.neutral1000,
  },
  bodyLight: {
    color: theme.colors.neutral200,
  },
  bodyBold: {
    fontFamily: "PlusJakartaSansBold",
  },
  tilesRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
  },
  tile: {
    flex: 1,
    padding: 24,
  },
});
