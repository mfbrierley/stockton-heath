import { theme } from "@/app/styles/theme";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";

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

type FuelPricesResponse = {
  data: StationPrices[];
  fetchedAt: number;
};

export function LocalFuelSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stations, setStations] = useState<StationPrices[]>([]);

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
        if (isMounted) setStations(json.data ?? []);
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
    return entry ? `${entry.price}p` : "—";
  }

  function getPriceValue(station: StationPrices, fuelType: string): number {
    const entry = station.fuel_prices.find((p) => p.fuel_type === fuelType);
    return entry ? entry.price : Infinity;
  }

  const sortedStations = [...stations].sort(
    (a, b) => getPriceValue(a, "E10") - getPriceValue(b, "E10"),
  );

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
          {/* Header row */}
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderStation}>STATION</Text>
            <Text style={styles.tableHeaderFuel}>PETROL E10</Text>
            <Text style={styles.tableHeaderFuel}>DIESEL B7</Text>
          </View>

          {/* Station rows */}
          {sortedStations.map((station) => {
            const isLowestPetrol =
              getPriceValue(station, "E10") === lowestPetrol;
            const isLowestDiesel =
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
  tableHeaderRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
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
  },
  tableFooterText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.neutral600,
    letterSpacing: 0.6,
  },
});
