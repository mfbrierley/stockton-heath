import { StyleSheet } from "react-native";
import { theme } from "./theme";

export const globalStyles = StyleSheet.create({
  // ─── Screen ───────────────────────────────────────────────
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.neutral200,
  },

  // ─── Cards ────────────────────────────────────────────────
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
  /** Strips padding from a card - use for list-style content cards */
  cardList: {
    padding: 0,
    overflow: "hidden",
  },
  /** Standard neutral header strip inside a list card */
  cardListHeader: {
    backgroundColor: theme.colors.neutral300,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  /** Font-size modifier for text inside a cardListHeader */
  cardListHeaderText: {
    fontSize: 15,
  },

  // ─── Tiles ────────────────────────────────────────────────
  tilesRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
  },
  tile: {
    flex: 1,
    padding: 24,
  },

  // ─── Headings ─────────────────────────────────────────────
  heading: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.heading,
    fontWeight: theme.fontWeights.regular,
    color: theme.colors.green1000,
  },
  /** Size modifier for large hero headings (32px) */
  headingLarge: {
    fontSize: 32,
    lineHeight: 48,
  },
  headingBold: {
    fontFamily: theme.fonts.headingBold,
  },
  headingWhite: {
    color: theme.colors.white,
  },
  headingNeutral: {
    color: theme.colors.neutral200,
  },
  headingNeutralDark: {
    color: theme.colors.neutralDark,
  },

  // ─── Body text ────────────────────────────────────────────
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
  /** 14px body text */
  bodySmall: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: theme.fontWeights.regular,
    color: theme.colors.neutral1000,
  },
  bodyBold: {
    fontFamily: theme.fonts.bodyBold,
  },
  /** Shared bold title for compact informational cards */
  cardTitle: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.green1000,
  },
  bodyLight: {
    color: theme.colors.neutral200,
  },
  /** Muted text - neutral700 colour modifier */
  bodyMuted: {
    color: theme.colors.neutral700,
  },
  /** Link-style text - green800 colour modifier */
  bodyLink: {
    color: theme.colors.green800,
  },

  // ─── Layout ───────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowSpaceBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.neutral300,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    lineHeight: 16,
  },

  // ─── Navigation ───────────────────────────────────────────
  /** Back button pressable row (stack screens) */
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
});
