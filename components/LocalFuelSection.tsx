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

  return (
    <View>
      <Text
        style={{
          fontSize: 24,
          fontFamily: "NotoSerif",
          color: "#1B4332",
          marginBottom: 16,
        }}
      >
        Local Fuel Prices
      </Text>

      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={{ color: "#DC2626" }}>{error}</Text>
      ) : (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", paddingBottom: 4 }}>
            <Text
              style={{
                flex: 2,
                fontFamily: "PlusJakartaSansBold",
                fontSize: 12,
                color: "#453B30",
              }}
            >
              STATION
            </Text>
            <Text
              style={{
                flex: 1,
                fontFamily: "PlusJakartaSansBold",
                fontSize: 12,
                color: "#453B30",
                textAlign: "right",
              }}
            >
              PETROL
            </Text>
            <Text
              style={{
                flex: 1,
                fontFamily: "PlusJakartaSansBold",
                fontSize: 12,
                color: "#453B30",
                textAlign: "right",
              }}
            >
              DIESEL
            </Text>
          </View>
          {stations.map((station) => (
            <View
              key={station.node_id}
              style={{
                flexDirection: "row",
                paddingVertical: 8,
                borderTopWidth: 1,
                borderTopColor: "#DFD5CA",
              }}
            >
              <Text
                style={{
                  flex: 2,
                  fontFamily: "PlusJakartaSans",
                  fontSize: 14,
                  color: "#453B30",
                }}
              >
                {station.trading_name}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontFamily: "PlusJakartaSansBold",
                  fontSize: 14,
                  color: "#453B30",
                  textAlign: "right",
                }}
              >
                {getPrice(station, "E10")}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontFamily: "PlusJakartaSansBold",
                  fontSize: 14,
                  color: "#453B30",
                  textAlign: "right",
                }}
              >
                {getPrice(station, "B7_STANDARD")}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
