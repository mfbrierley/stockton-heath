import { theme } from "@/app/styles/theme";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

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
      <Text
        style={{
          fontSize: 24,
          fontFamily: "NotoSerif",
          color: theme.colors.primary,
          marginBottom: 16,
        }}
      >
        Local Fuel Prices
      </Text>

      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={{ color: theme.colors.statusRed }}>{error}</Text>
      ) : (
        <View
          style={{
            backgroundColor: theme.colors.white,
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          {/* Header row */}
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: 12,
            }}
          >
            <Text
              style={{
                flex: 2,
                fontFamily: "PlusJakartaSansBold",
                fontSize: 11,
                color: theme.colors.neutral600,
                letterSpacing: 0.6,
              }}
            >
              STATION
            </Text>
            <Text
              style={{
                flex: 1,
                fontFamily: "PlusJakartaSansBold",
                fontSize: 11,
                color: theme.colors.neutral600,
                letterSpacing: 0.6,
                textAlign: "center",
              }}
            >
              PETROL E10
            </Text>
            <Text
              style={{
                flex: 1,
                fontFamily: "PlusJakartaSansBold",
                fontSize: 11,
                color: theme.colors.neutral600,
                letterSpacing: 0.6,
                textAlign: "center",
              }}
            >
              DIESEL B7
            </Text>
          </View>

          {/* Station rows */}
          {sortedStations.map((station) => {
            const isLowestPetrol =
              getPriceValue(station, "E10") === lowestPetrol;
            const isLowestDiesel =
              getPriceValue(station, "B7_STANDARD") === lowestDiesel;
            return (
              <View
                key={station.node_id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.neutral300,
                }}
              >
                <View style={{ flex: 2 }}>
                  <Text
                    style={{
                      fontFamily: "PlusJakartaSansBold",
                      fontSize: 14,
                      color: theme.colors.neutral1100,
                    }}
                  >
                    {station.display_name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Feather
                      name="map-pin"
                      size={11}
                      color={theme.colors.neutral600}
                    />
                    <Text
                      style={{
                        fontFamily: "PlusJakartaSans",
                        fontSize: 12,
                        color: theme.colors.neutral600,
                      }}
                    >
                      {station.location}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                  <Text
                    style={{
                      fontFamily: "PlusJakartaSansBold",
                      fontSize: 20,
                      color: theme.colors.neutral1100,
                    }}
                  >
                    {getPrice(station, "E10")}
                  </Text>
                  {isLowestPetrol && (
                    <View
                      style={{
                        backgroundColor: theme.colors.primary,
                        borderRadius: 20,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSansBold",
                          fontSize: 9,
                          color: theme.colors.white,
                          letterSpacing: 0.6,
                        }}
                      >
                        LOWEST
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                  <Text
                    style={{
                      fontFamily: "PlusJakartaSansBold",
                      fontSize: 20,
                      color: theme.colors.neutral1100,
                    }}
                  >
                    {getPrice(station, "B7_STANDARD")}
                  </Text>
                  {isLowestDiesel && (
                    <View
                      style={{
                        backgroundColor: theme.colors.primary,
                        borderRadius: 20,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSansBold",
                          fontSize: 9,
                          color: theme.colors.white,
                          letterSpacing: 0.6,
                        }}
                      >
                        LOWEST
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Footer */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: theme.colors.neutral300,
              paddingHorizontal: 24,
              paddingBottom: 24,
              paddingTop: 12,
            }}
          >
            <Text
              style={{
                fontFamily: "PlusJakartaSansBold",
                fontSize: 11,
                color: theme.colors.neutral600,
                letterSpacing: 0.6,
              }}
            >
              UPDATED EVERY 30 MINS
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
