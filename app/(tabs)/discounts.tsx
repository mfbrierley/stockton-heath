import Feather from "@expo/vector-icons/Feather";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DiscountCard from "../../components/DiscountCard";
import { useBusinessListings } from "../../hooks/useBusinessListings";
import { globalStyles } from "../styles/globalStyles";
import { theme } from "../styles/theme";

// Where a business signs itself up. The same address the invitation emails
// send them to.
const PORTAL_URL = "https://stockton-heath-support.vercel.app/business";

// The one category with a fixed position in the filter row. Matched by value
// because that is what the backend stores; if it were ever renamed there this
// would stop pinning it and sort it alphabetically instead, which is a worse
// row rather than a broken one.
const OTHER = "Other";

export default function Discounts() {
  const { listings, loading, refreshing, error, refresh } =
    useBusinessListings();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const search = query.trim().toLowerCase();

  // Built from the listings themselves rather than a copy of the backend's
  // list, so there is no fourth place for the categories to drift out of step
  // and no filter that returns nothing. Alphabetical with Other last, since
  // "Other" is where a business lands when none of the rest fit and reads
  // oddly in the middle of the row.
  const categories = useMemo(() => {
    const present = [...new Set(listings.map((listing) => listing.category))];
    return present.sort((a, b) => {
      if (a === OTHER) return 1;
      if (b === OTHER) return -1;
      return a.localeCompare(b);
    });
  }, [listings]);

  // A category chosen and then emptied - every listing under it was edited,
  // or stopped paying - would otherwise leave the screen filtered to nothing
  // by a chip that is no longer on it.
  const activeCategory =
    category !== null && categories.includes(category) ? category : null;

  // Matches the discount as well as the name, so someone looking for
  // "coffee" or "10%" finds the shop offering it without having to know
  // what the shop is called.
  const matches = useMemo(() => {
    return listings.filter((listing) => {
      if (activeCategory !== null && listing.category !== activeCategory) {
        return false;
      }
      if (!search) return true;
      return (
        listing.businessName.toLowerCase().includes(search) ||
        listing.discountText.toLowerCase().includes(search)
      );
    });
  }, [listings, search, activeCategory]);

  // An error only takes over the screen when there is nothing else to put
  // there. A refresh that fails with listings already up leaves them alone -
  // they are still the last thing the backend actually said.
  const showError = error !== null && listings.length === 0;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: 16,
        paddingHorizontal: 20,
        paddingBottom: 32,
        gap: 20,
      }}
      style={{ backgroundColor: theme.colors.neutral200, flex: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={theme.colors.green800}
          colors={[theme.colors.green800]}
        />
      }
    >
      <View style={styles.intro}>
        <Text style={globalStyles.heading}>Local discounts</Text>
        {/* There is no per-listing "how to redeem" field, so the one
            instruction that applies to all of them is said once, here. */}
        <Text style={[globalStyles.body, styles.introBody]}>
          Savings from businesses around Stockton Heath, for people with the
          app. Show your phone when you pay to claim one.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : showError ? (
        <Text style={[globalStyles.body, styles.error]}>{error}</Text>
      ) : listings.length === 0 ? (
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Feather name="tag" size={24} color={theme.colors.green800} />
          </View>
          <Text style={globalStyles.cardTitle}>No discounts just now</Text>
          <Text style={[globalStyles.body, styles.muted]}>
            Local businesses are still signing up. Pull down to check again.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.searchField}>
            <Feather
              name="search"
              size={20}
              color={theme.colors.neutral400}
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="Search a business or a discount"
              placeholderTextColor={theme.colors.neutral600}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery("")}
                accessibilityLabel="Clear search"
                hitSlop={8}
                style={styles.searchClear}
              >
                <Feather
                  name="x-circle"
                  size={20}
                  color={theme.colors.neutral600}
                />
              </Pressable>
            )}
          </View>

          {/* Only worth a row when there is a choice to make. One category
              means every chip but "All" selects everything anyway. */}
          {categories.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              // Negative margins let the row bleed to the screen edges while
              // the page keeps its 20pt gutter, so a scrollable row looks
              // scrollable rather than stopping short of the edge.
              style={styles.filterRow}
              contentContainerStyle={styles.filterRowContent}
            >
              {[null, ...categories].map((option) => {
                const selected = activeCategory === option;
                return (
                  <Pressable
                    key={option ?? "all"}
                    onPress={() => setCategory(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.filter, selected && styles.filterOn]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        selected && styles.filterTextOn,
                      ]}
                    >
                      {option ?? "All"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {matches.length === 0 ? (
            <View style={styles.card}>
              <Text style={globalStyles.cardTitle}>
                {search
                  ? `Nothing matches “${query.trim()}”`
                  : `Nothing under ${activeCategory} just now`}
              </Text>
              {/* Says which filters it is about to drop, because clearing
                  both when only one was set reads as the screen forgetting
                  what you asked for. */}
              {search && activeCategory !== null && (
                <Text style={[globalStyles.body, styles.muted]}>
                  You are also only seeing {activeCategory}.
                </Text>
              )}
              <Pressable
                onPress={() => {
                  setQuery("");
                  setCategory(null);
                }}
              >
                <Text style={[globalStyles.body, globalStyles.bodyLink]}>
                  Show every discount
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.list}>
              {matches.map((listing) => (
                <DiscountCard key={listing.id} listing={listing} />
              ))}
            </View>
          )}
        </>
      )}

      {/* Kept out of the branches above on purpose: someone who runs a shop is
          most likely to look here when the list is short or empty. */}
      {!loading && (
        <>
          <View style={globalStyles.divider} />
          <Pressable onPress={() => void Linking.openURL(PORTAL_URL)}>
            <View style={styles.card}>
              <Text style={globalStyles.cardTitle}>Run a local business?</Text>
              <Text style={[globalStyles.body, styles.muted]}>
                Put a discount in front of everyone in the village who has the
                app.
              </Text>
              <View style={styles.linkRow}>
                <Text style={[globalStyles.body, globalStyles.bodyLink]}>
                  Find out how
                </Text>
                <Feather
                  name="external-link"
                  size={14}
                  color={theme.colors.green800}
                />
              </View>
            </View>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: 8,
  },
  introBody: {
    color: theme.colors.neutral800,
  },
  list: {
    gap: 16,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.green100,
  },
  muted: {
    color: theme.colors.neutral800,
  },
  error: {
    color: theme.colors.statusRed,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 16,
  },
  searchIcon: {
    marginLeft: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 16,
    paddingLeft: 8,
    paddingRight: 16,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.body,
    color: theme.colors.neutral1000,
  },
  searchClear: {
    marginRight: 12,
  },
  filterRow: {
    marginHorizontal: -20,
  },
  filterRowContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filter: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.neutral300,
  },
  filterOn: {
    backgroundColor: theme.colors.green800,
    borderColor: theme.colors.green800,
  },
  filterText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    lineHeight: 18,
    color: theme.colors.neutral900,
  },
  filterTextOn: {
    color: theme.colors.white,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
});
