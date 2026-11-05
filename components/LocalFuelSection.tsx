import { theme } from "@/app/styles/theme";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FUEL_FINDER_URL } from "@/utils/dataSources";
import { globalStyles } from "../app/styles/globalStyles";
import SourceNote from "./SourceNote";

type FuelPrice = {
  fuel_type: string;
  price: number;
  price_last_updated: string;
};

type StationPrices = {
  node_id: string;
  trading_name: string;
  display_name: string;
  location: string;
  fuel_prices: FuelPrice[];
};

/**
 * `data` is the five cheapest stations for petrol and `diesel` the five
 * cheapest for diesel, both within five miles of Stockton Heath. A backend
 * from before the diesel list sends `data` alone.
 */
type FuelPricesResponse = {
  data: StationPrices[];
  diesel?: StationPrices[];
  fetchedAt: number;
};

type Fuel = "E10" | "B7_STANDARD";

const FUEL_OPTIONS: { fuel: Fuel; label: string }[] = [
  { fuel: "E10", label: "Petrol" },
  { fuel: "B7_STANDARD", label: "Diesel" },
];

// Remembered so someone who drives a diesel doesn't have to switch each time.
const FUEL_CHOICE_KEY = "fuelPricesFuelType";

export function LocalFuelSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [petrolStations, setPetrolStations] = useState<StationPrices[]>([]);
  const [dieselStations, setDieselStations] = useState<StationPrices[] | null>(
    null,
  );
  const [fuel, setFuel] = useState<Fuel>("E10");

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(FUEL_CHOICE_KEY)
      .then((saved) => {
        if (isMounted && saved === "B7_STANDARD") setFuel(saved);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const chooseFuel = (choice: Fuel) => {
    setFuel(choice);
    AsyncStorage.setItem(FUEL_CHOICE_KEY, choice).catch(() => {});
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchFuelPrices() {
      try {
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
        if (!backendUrl) throw new Error("EXPO_PUBLIC_BACKEND_URL is not set");

        const res = await fetch(`${backendUrl}/fuel-prices`);
        if (res.status === 503)
          throw new Error("Fuel prices loading, try again shortly");
        if (!res.ok) throw new Error(`${res.status}`);

        const json = (await res.json()) as FuelPricesResponse;
        if (isMounted) {
          setPetrolStations(json.data ?? []);
          setDieselStations(Array.isArray(json.diesel) ? json.diesel : null);
        }
      } catch (err) {
        if (isMounted)
          setError(
            err instanceof Error ? err.message : "Failed to load fuel prices",
          );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchFuelPrices();
    return () => {
      isMounted = false;
    };
  }, []);

  function getPrice(station: StationPrices, fuelType: string): string {
    const entry = station.fuel_prices.find((p) => p.fuel_type === fuelType);
    return entry ? `${entry.price}p` : "-";
  }

  function getPriceValue(station: StationPrices, fuelType: string): number {
    const entry = station.fuel_prices.find((p) => p.fuel_type === fuelType);
    return entry ? Number(entry.price) : Infinity;
  }

  // Without a diesel list (an older backend) there is no switch, and the card
  // shows the petrol list with both columns' lowest prices, as it used to.
  const canSwitch = dieselStations !== null;
  const shownFuel: Fuel = canSwitch ? fuel : "E10";
  const stations =
    shownFuel === "B7_STANDARD" && dieselStations
      ? dieselStations
      : petrolStations;

  const sortedStations = [...stations].sort(
    (a, b) => getPriceValue(a, shownFuel) - getPriceValue(b, shownFuel),
  );

  // The list is ranked on one fuel, so the other column's lowest price would
  // only be the lowest of these five - the badge marks the chosen fuel only.
  const badgePetrol = !canSwitch || shownFuel === "E10";
  const badgeDiesel = !canSwitch || shownFuel === "B7_STANDARD";

  const lowestPetrol = Math.min(
    ...stations.map((s) => getPriceValue(s, "E10")),
  );
  const lowestDiesel = Math.min(
    ...stations.map((s) => getPriceValue(s, "B7_STANDARD")),
  );

  return (
    <View>
      <Text style={[globalStyles.heading, { marginBottom: 16 }]}>
        Local Fuel Prices
      </Text>

      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={[globalStyles.body, styles.errorText]}>{error}</Text>
      ) : (
        <View style={styles.table}>
          {canSwitch && (
            <View style={styles.fuelSwitch} accessibilityRole="tablist">
              {FUEL_OPTIONS.map((option) => {
                const selected = option.fuel === shownFuel;
                return (
                  <Pressable
                    key={option.fuel}
                    onPress={() => chooseFuel(option.fuel)}
                    style={[
                      styles.fuelOption,
                      selected && styles.fuelOptionSelected,
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.fuelOptionText,
                        selected && styles.fuelOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Header row */}
          <View
            style={[
              styles.tableHeaderRow,
              canSwitch && styles.tableHeaderRowBelowSwitch,
            ]}
          >
            <Text style={styles.tableHeaderStation}>STATION</Text>
            <Text style={styles.tableHeaderFuel}>PETROL E10</Text>
            <Text style={styles.tableHeaderFuel}>DIESEL B7</Text>
          </View>

          {/* Station rows */}
          {sortedStations.map((station) => {
            const isLowestPetrol =
              badgePetrol &&
              Number.isFinite(lowestPetrol) &&
              getPriceValue(station, "E10") === lowestPetrol;
            const isLowestDiesel =
              badgeDiesel &&
              Number.isFinite(lowestDiesel) &&
              getPriceValue(station, "B7_STANDARD") === lowestDiesel;
            return (
              <View key={station.node_id} style={styles.tableRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.stationName}>{station.display_name}</Text>
                  <View style={styles.locationRow}>
                    <Feather
                      name="map-pin"
                      size={11}
                      color={theme.colors.neutral600}
                    />
                    <Text style={styles.stationLocation}>
                      {station.location}
                    </Text>
                  </View>
                </View>
                <View style={styles.priceCell}>
                  <Text style={styles.priceText}>
                    {getPrice(station, "E10")}
                  </Text>
                  {isLowestPetrol && (
                    <View style={styles.lowestBadge}>
                      <Text style={styles.lowestBadgeText}>LOWEST</Text>
                    </View>
                  )}
                </View>
                <View style={styles.priceCell}>
                  <Text style={styles.priceText}>
                    {getPrice(station, "B7_STANDARD")}
                  </Text>
                  {isLowestDiesel && (
                    <View style={styles.lowestBadge}>
                      <Text style={styles.lowestBadgeText}>LOWEST</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Footer */}
          <View style={styles.tableFooter}>
            <Text style={styles.tableFooterText}>UPDATED EVERY 30 MINS</Text>
            <SourceNote
              label="Prices from the UK Government's Fuel Finder scheme. Source:"
              url={FUEL_FINDER_URL}
              androidOnly
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: theme.colors.statusRed,
  },
  table: {
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    overflow: "hidden",
  },
  fuelSwitch: {
    flexDirection: "row",
    marginHorizontal: 24,
    marginTop: 24,
    padding: 4,
    borderRadius: 20,
    backgroundColor: theme.colors.neutral200,
  },
  fuelOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 16,
  },
  fuelOptionSelected: {
    backgroundColor: theme.colors.primary,
  },
  fuelOptionText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.neutral900,
  },
  fuelOptionTextSelected: {
    color: theme.colors.white,
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  tableHeaderRowBelowSwitch: {
    paddingTop: 20,
  },
  tableHeaderStation: {
    flex: 2,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.neutral600,
    letterSpacing: 0.6,
  },
  tableHeaderFuel: {
    flex: 1,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.neutral600,
    letterSpacing: 0.6,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral300,
  },
  stationName: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.neutral1100,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  stationLocation: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.neutral600,
  },
  priceCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  priceText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 20,
    color: theme.colors.neutral1100,
  },
  lowestBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lowestBadgeText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9,
    color: theme.colors.white,
    letterSpacing: 0.6,
  },
  tableFooter: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral300,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    gap: 6,
  },
  tableFooterText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.neutral600,
    letterSpacing: 0.6,
  },
});
