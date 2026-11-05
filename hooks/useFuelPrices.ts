import { useEffect, useState } from "react";

export type FuelPrice = {
  fuel_type: string;
  price: number;
  price_last_updated: string;
};

export type StationPrices = {
  node_id: string;
  trading_name: string;
  display_name: string;
  location: string;
  public_phone_number?: string | null;
  fuel_prices: FuelPrice[];
  // For the station's own screen. A backend from before November 2026
  // doesn't send these.
  latitude?: number;
  longitude?: number;
  address?: string;
  amenities?: string[];
  distance_miles?: number;
};

/**
 * `data` is the five cheapest stations for petrol and `diesel` the five
 * cheapest for diesel, both within five miles of Stockton Heath. A backend
 * from before the diesel list sends `data` alone.
 */
export type FuelPricesResponse = {
  data: StationPrices[];
  diesel?: StationPrices[];
  fetchedAt: number;
};

// The last reply, kept so a station's screen opens with the station the
// list showed instead of waiting on a second request.
let lastPrices: FuelPricesResponse | null = null;
let pending: Promise<FuelPricesResponse> | null = null;

async function fetchFuelPrices(): Promise<FuelPricesResponse> {
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backendUrl) throw new Error("EXPO_PUBLIC_BACKEND_URL is not set");

  // v=2 asks for the two five-station lists. Without it the backend sends
  // the three village stations the app before November 2026 shows.
  const res = await fetch(`${backendUrl}/fuel-prices?v=2`);
  if (res.status === 503)
    throw new Error("Fuel prices loading, try again shortly");
  if (!res.ok) throw new Error(`${res.status}`);

  const json = (await res.json()) as FuelPricesResponse;
  lastPrices = { ...json, data: json.data ?? [] };
  return lastPrices;
}

/**
 * The fuel prices from the backend, read afresh each time a screen using
 * this opens. Screens opened at the same moment share one request.
 */
export function useFuelPrices() {
  const [prices, setPrices] = useState<FuelPricesResponse | null>(lastPrices);
  const [loading, setLoading] = useState(lastPrices === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    pending ??= fetchFuelPrices().finally(() => {
      pending = null;
    });
    pending
      .then((latest) => {
        if (!isMounted) return;
        setPrices(latest);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load fuel prices",
        );
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return { prices, loading, error };
}

/** The station in either list, or undefined. */
export function findStation(
  prices: FuelPricesResponse | null,
  nodeId: string,
): StationPrices | undefined {
  if (!prices) return undefined;
  return [...prices.data, ...(prices.diesel ?? [])].find(
    (s) => s.node_id === nodeId,
  );
}
