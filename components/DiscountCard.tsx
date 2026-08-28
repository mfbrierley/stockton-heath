import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import { BusinessListing } from "../app/types/businessListing";

// One business's discount.
//
// This is drawn to match DiscountPreview in the portal, which businesses write
// their listing against under the heading "How residents will see it". If the
// two drift apart that preview stops being true, so the sizes and colours here
// are deliberately the same numbers rather than near-enough ones.
export default function DiscountCard({
  listing,
}: {
  listing: BusinessListing;
}) {
  const description = listing.description.trim();

  return (
    <View style={styles.card}>
      {/* Null on every listing until Cloudflare R2 is configured, so the
          card without a photo is the ordinary case rather than a fallback. */}
      {listing.imageUrl && (
        <Image
          source={{ uri: listing.imageUrl }}
          style={styles.photo}
          contentFit="cover"
          transition={200}
        />
      )}

      <Text style={globalStyles.cardTitle}>{listing.businessName}</Text>

      <View style={[globalStyles.statusBadge, styles.badge]}>
        <Feather name="tag" size={13} color={theme.colors.green800} />
        {/* A discount can run to 120 characters, so the pill has to be able
            to wrap rather than run off the side of the card. */}
        <Text style={[globalStyles.statusBadgeText, styles.badgeText]}>
          {listing.discountText}
        </Text>
      </View>

      {/* The terms are optional and arrive as "", so the paragraph goes
          altogether rather than leaving a gap under the discount. */}
      {description.length > 0 && (
        <Text style={[globalStyles.body, styles.description]}>
          {description}
        </Text>
      )}
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
  photo: {
    width: "100%",
    height: 150,
    borderRadius: 12,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.green100,
  },
  badgeText: {
    color: theme.colors.green800,
    flexShrink: 1,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.neutral800,
  },
});
