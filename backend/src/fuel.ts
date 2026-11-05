// Fuel prices for the Home screen: the six cheapest stations within five
// miles of Stockton Heath for petrol, and the six cheapest for diesel, read
// from the UK Government's Fuel Finder API and served to the app from memory.
//
// Fuel Finder publishes two datasets, both in numbered batches covering the
// whole UK. /pfs holds each forecourt's details and position. Those rarely
// change, so it is read once a day to work out which stations are within the
// radius. /pfs/fuel-prices holds prices and no positions, and is read every
// 30 minutes for just those stations.
//
// /fuel-prices has two answers. The app from November 2026 asks with ?v=2
// and gets the two lists. Without it, it gets what it has always sent: the
// three stations near the village. That keeps the app residents already have
// unchanged until the new one reaches them, and must stay while versions
// that never had the over-the-air update are still in use.

const FUEL_FINDER_TOKEN_URL =
  "https://www.fuel-finder.service.gov.uk/api/v1/oauth/generate_access_token";
const FUEL_FINDER_STATIONS_URL =
  "https://www.fuel-finder.service.gov.uk/api/v1/pfs";
const FUEL_FINDER_PRICES_URL =
  "https://www.fuel-finder.service.gov.uk/api/v1/pfs/fuel-prices";

// The same point the weather and NHS dentists are read for.
const STOCKTON_HEATH = { latitude: 53.3705, longitude: -2.5811 };
const RADIUS_MILES = 5;
const STATIONS_SHOWN = 6;

export const FUEL_PRICES_REFRESH_MS = 30 * 60 * 1000;
const STATIONS_REFRESH_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;

// A safety cap on the batch loop. The whole UK is a few dozen batches.
const MAX_BATCHES = 200;

// A price is left out of the ranking when it is plainly wrong (in pounds
// rather than pence, say) or has not been updated for a month. Either would
// otherwise sit at the top of a cheapest-first list indefinitely. The age
// limit is generous because retailers only report a price when it changes,
// so an independent's correct price can go unchanged for weeks.
const MIN_PLAUSIBLE_PENCE = 100;
const MAX_PLAUSIBLE_PENCE = 250;
const MAX_PRICE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const DISPLAY_FUEL_TYPES = new Set(["E10", "B7_STANDARD"]);

/**
 * Friendly local names for the three stations nearest the village, keyed by
 * Fuel Finder node_id. These are the app's OWN labels, not the operator's
 * registered names - locals say "Morrisons", not the trading name on the
 * licence. Every other station is named from its brand and street as Fuel
 * Finder publishes them (see displayInfo). The API's trading_name is passed
 * through untouched alongside. Prices are never altered.
 */
const STATION_DISPLAY_INFO: Record<
  string,
  { display_name: string; location: string }
> = {
  "78e106b10ddec09572a290959030b50fbe237f6913711e24d5a465fbe6220e61": {
    display_name: "ASDA Causeway",
    location: "Wilderspool Causeway",
  },
  "751b9cfbdf59cba708c06226acef37f63dae67b933732d7c67976daf58af7d39": {
    display_name: "ESSO Latchford",
    location: "Knutsford Road",
  },
  "0ee49af1acdf5301f588d07afc3d9c274bfbffd56a3cb25cf830dfd336b6d7ae": {
    display_name: "Morrisons",
    location: "Stockton Heath",
  },
};

type FuelPrice = {
  fuel_type: string;
  price: number;
  price_last_updated: string;
  price_change_effective_timestamp: string;
};

/** One station's prices as /pfs/fuel-prices sends them. */
type PriceRow = {
  node_id: string;
  trading_name: string;
  public_phone_number: string | null;
  fuel_prices: FuelPrice[];
};

/** One station as the app is sent it. */
type StationPrices = PriceRow & {
  display_name: string;
  location: string;
};

/** The new app also gets what the station's own screen shows. */
type StationDetails = StationPrices & {
  latitude: number;
  longitude: number;
  address: string;
  amenities: string[];
  distance_miles: number;
};

/** A forecourt as /pfs describes it - only the fields read here. */
type Forecourt = {
  node_id: string;
  trading_name?: string | null;
  brand_name?: string | null;
  permanent_closure?: boolean | null;
  amenities?: unknown;
  location?: {
    address_line_1?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    postcode?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  } | null;
};

type NearbyStation = {
  display_name: string;
  location: string;
  latitude: number;
  longitude: number;
  address: string;
  amenities: string[];
  distance_miles: number;
};

type FuelPricesResponses = {
  /** Without ?v=2: the three village stations, exactly as before. */
  current: { data: StationPrices[]; fetchedAt: number };
  /** ?v=2: the six cheapest within the radius, petrol and diesel. */
  v2: {
    data: StationDetails[];
    diesel: StationDetails[];
    fetchedAt: number;
  } | null;
};

let cachedFuelToken: { value: string; expiresAt: number } | null = null;
let nearbyStations: {
  stations: Map<string, NearbyStation>;
  fetchedAt: number;
} | null = null;
let cachedFuelPrices: FuelPricesResponses | null = null;

/** The answer for the app asking, or null until it has been read. */
export const getCachedFuelPrices = (v2: boolean) =>
  (v2 ? cachedFuelPrices?.v2 : cachedFuelPrices?.current) ?? null;

async function getFuelFinderToken(): Promise<string> {
  if (cachedFuelToken && Date.now() < cachedFuelToken.expiresAt - 60_000) {
    return cachedFuelToken.value;
  }

  const clientId = process.env.FUEL_FINDER_CLIENT_ID;
  const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing FUEL_FINDER_CLIENT_ID or FUEL_FINDER_CLIENT_SECRET",
    );
  }

  const res = await fetch(FUEL_FINDER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(
      `Fuel Finder token request failed: ${res.status} ${await res.text()}`,
    );
  }

  const json = (await res.json()) as {
    data: { access_token: string; expires_in: number };
  };

  cachedFuelToken = {
    value: json.data.access_token,
    expiresAt: Date.now() + json.data.expires_in * 1000,
  };

  return cachedFuelToken.value;
}

/**
 * Read a Fuel Finder dataset batch by batch, handing each batch to `onBatch`
 * until it returns true, the batches run out, or a request fails. Returns
 * false on a failure, so the caller can keep what it had.
 *
 * Past the last batch the API answers 404 rather than an empty list, so a 404
 * after the first batch is the end of the data, not an error.
 */
async function readBatches(
  url: string,
  onBatch: (rows: unknown[]) => boolean,
): Promise<boolean> {
  const token = await getFuelFinderToken();

  for (let batch = 1; batch <= MAX_BATCHES; batch++) {
    const res = await fetch(`${url}?batch-number=${batch}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 404 && batch > 1) return true;
    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      console.error(
        `Fuel Finder request failed: ${url} batch ${batch}: ${res.status} - ${body}`,
      );
      return false;
    }

    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows) || rows.length === 0) return true;
    if (onBatch(rows)) return true;
  }

  console.error(`Fuel Finder: more than ${MAX_BATCHES} batches at ${url}`);
  return false;
}

function milesBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

// Brands usually written in capitals, matching the labels above.
const KEEP_CAPITALS = new Set(["ASDA", "ESSO"]);

/**
 * Fuel Finder's names are often all capitals ("TESCO", "WINWICK ROAD").
 * Capitalised words of four letters or more are put in title case. Shorter
 * ones are left alone because they are usually initials (BP, JET, MFG).
 */
const tidy = (text: string): string =>
  text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b[A-Z][A-Z']{3,}\b/g, (word) =>
      KEEP_CAPITALS.has(word) ? word : word[0] + word.slice(1).toLowerCase(),
    );

function displayInfo(forecourt: Forecourt): {
  display_name: string;
  location: string;
} {
  const own = STATION_DISPLAY_INFO[forecourt.node_id];
  if (own) return own;
  const name = forecourt.brand_name?.trim() || forecourt.trading_name?.trim();
  const place =
    forecourt.location?.address_line_1?.trim() ||
    forecourt.location?.city?.trim();
  return {
    display_name: name ? tidy(name) : "Fuel station",
    location: place ? tidy(place) : "",
  };
}

/** One line: the street, town and postcode, without repeats. */
function fullAddress(location: Forecourt["location"]): string {
  const parts: string[] = [];
  for (const line of [
    location?.address_line_1,
    location?.address_line_2,
    location?.city,
  ]) {
    const tidied = line?.trim() ? tidy(line) : "";
    if (tidied && !parts.some((p) => p.toLowerCase() === tidied.toLowerCase())) {
      parts.push(tidied);
    }
  }
  const postcode = location?.postcode?.trim().toUpperCase();
  if (postcode) parts.push(postcode);
  return parts.join(", ");
}

// Words that read wrongly in sentence case.
const AMENITY_WORDS: Record<string, string> = {
  adblue: "AdBlue",
  atm: "ATM",
  ev: "EV",
  hvo: "HVO",
  lpg: "LPG",
  wifi: "Wi-Fi",
};

/**
 * Fuel Finder lists a forecourt's facilities as codes ("car_wash"). They are
 * shown as written, in sentence case ("Car wash"). The codes are logged with
 * each station list so a label that reads badly can be added above.
 */
function amenityLabels(amenities: unknown): string[] {
  if (!Array.isArray(amenities)) return [];
  return amenities
    .filter((a): a is string => typeof a === "string" && a.trim() !== "")
    .map((code) =>
      code
        .toLowerCase()
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((w) => (Object.hasOwn(AMENITY_WORDS, w) ? AMENITY_WORDS[w] : w))
        .join(" "),
    )
    .filter(Boolean)
    .map((label) => label[0].toUpperCase() + label.slice(1));
}

/**
 * Work out which stations are within the radius. A failed read keeps the
 * last list. So does a read that finds none, which would mean /pfs no longer
 * carries positions where this expects them.
 */
async function syncNearbyStations(): Promise<void> {
  const found = new Map<string, NearbyStation>();
  const amenityCodes = new Set<string>();
  let unplaced = 0;

  // Every batch is read: there is no telling which one holds the last
  // nearby station.
  const ok = await readBatches(FUEL_FINDER_STATIONS_URL, (rows) => {
    for (const forecourt of rows as Forecourt[]) {
      if (!forecourt?.node_id || forecourt.permanent_closure) continue;
      const latitude = Number(forecourt.location?.latitude);
      const longitude = Number(forecourt.location?.longitude);
      if (
        forecourt.location?.latitude == null ||
        forecourt.location?.longitude == null ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        unplaced++;
        continue;
      }
      const distance = milesBetween(STOCKTON_HEATH, { latitude, longitude });
      if (distance <= RADIUS_MILES) {
        found.set(forecourt.node_id, {
          ...displayInfo(forecourt),
          latitude,
          longitude,
          address: fullAddress(forecourt.location),
          amenities: amenityLabels(forecourt.amenities),
          distance_miles: distance,
        });
        if (Array.isArray(forecourt.amenities)) {
          for (const code of forecourt.amenities) amenityCodes.add(String(code));
        }
      }
    }
    return false;
  });

  if (!ok) {
    console.warn(
      `[${new Date().toISOString()}] Fuel station list sync failed - keeping the last list.`,
    );
    return;
  }
  if (found.size === 0) {
    console.error(
      `[${new Date().toISOString()}] Fuel Finder listed no stations within ${RADIUS_MILES} miles (${unplaced} had no position) - keeping the last list.`,
    );
    return;
  }

  nearbyStations = { stations: found, fetchedAt: Date.now() };
  const names = [...found.values()]
    .sort((a, b) => a.distance_miles - b.distance_miles)
    .map(
      (s) =>
        `${s.display_name}${s.location ? `, ${s.location}` : ""} (${s.distance_miles.toFixed(1)} mi)`,
    );
  console.log(
    `[${new Date().toISOString()}] Fuel stations synced. ${found.size} within ${RADIUS_MILES} miles (${unplaced} with no position skipped): ${names.join("; ")}. Facility codes: ${[...amenityCodes].sort().join(", ") || "none"}`,
  );
}

function isTrustworthy(price: FuelPrice, now: number): boolean {
  const pence = Number(price.price);
  const updated = Date.parse(price.price_last_updated);
  return (
    Number.isFinite(pence) &&
    pence >= MIN_PLAUSIBLE_PENCE &&
    pence <= MAX_PLAUSIBLE_PENCE &&
    Number.isFinite(updated) &&
    now - updated <= MAX_PRICE_AGE_MS
  );
}

type Ranked = { prices: StationDetails; distance_miles: number };

/** The cheapest stations for one fuel; a tie goes to the nearer station. */
function cheapest(stations: Ranked[], fuelType: string): StationDetails[] {
  const priceOf = (s: Ranked) =>
    Number(s.prices.fuel_prices.find((p) => p.fuel_type === fuelType)?.price);
  return stations
    .filter((s) => Number.isFinite(priceOf(s)))
    .sort(
      (a, b) => priceOf(a) - priceOf(b) || a.distance_miles - b.distance_miles,
    )
    .slice(0, STATIONS_SHOWN)
    .map((s) => s.prices);
}

// Never throws. This runs on a timer inside the same process as the weather,
// bins and bridge alerts. A failed read keeps the last good prices.
export async function syncFuelPrices(): Promise<void> {
  try {
    if (
      !nearbyStations ||
      Date.now() - nearbyStations.fetchedAt >= STATIONS_REFRESH_MS
    ) {
      await syncNearbyStations();
    }

    // The village stations are read whatever happened to the station list,
    // so the current app never depends on it.
    const villageIds = Object.keys(STATION_DISPLAY_INFO);
    const nearby = nearbyStations?.stations ?? new Map<string, NearbyStation>();
    const wanted = new Set([...villageIds, ...nearby.keys()]);
    const rows = new Map<string, PriceRow>();

    const ok = await readBatches(FUEL_FINDER_PRICES_URL, (batch) => {
      for (const row of batch as PriceRow[]) {
        if (row?.node_id && wanted.has(row.node_id)) {
          rows.set(row.node_id, row);
        }
      }
      return rows.size === wanted.size;
    });

    if (!ok) {
      console.warn(
        `[${new Date().toISOString()}] Fuel price sync failed - retaining last cached data.`,
      );
      return;
    }

    const now = Date.now();
    const shownPrices = (row: PriceRow) =>
      (row.fuel_prices ?? []).filter((p) => DISPLAY_FUEL_TYPES.has(p.fuel_type));

    // Exactly what the app was sent before ?v=2: no age or range check.
    const current: StationPrices[] = villageIds.flatMap((id) => {
      const row = rows.get(id);
      return row
        ? [{ ...row, ...STATION_DISPLAY_INFO[id], fuel_prices: shownPrices(row) }]
        : [];
    });

    // Until the first station list has been read the new app is told to try
    // again shortly.
    let v2 = cachedFuelPrices?.v2 ?? null;
    let priced = 0;
    let dropped = 0;
    if (nearby.size > 0) {
      const ranked: Ranked[] = [...nearby].flatMap(([id, station]) => {
        const row = rows.get(id);
        if (!row) return [];
        priced++;
        const shown = shownPrices(row);
        const fuel_prices = shown.filter((p) => isTrustworthy(p, now));
        dropped += shown.length - fuel_prices.length;
        return [
          {
            prices: {
              ...row,
              display_name: station.display_name,
              location: station.location,
              fuel_prices,
              latitude: station.latitude,
              longitude: station.longitude,
              address: station.address,
              amenities: station.amenities,
              distance_miles: Math.round(station.distance_miles * 10) / 10,
            },
            distance_miles: station.distance_miles,
          },
        ];
      });
      v2 = {
        data: cheapest(ranked, "E10"),
        diesel: cheapest(ranked, "B7_STANDARD"),
        fetchedAt: now,
      };
    }

    cachedFuelPrices = { current: { data: current, fetchedAt: now }, v2 };
    console.log(
      `[${new Date().toISOString()}] Fuel prices synced. ${current.length} of ${villageIds.length} village station(s) for the current app; ${priced} of ${nearby.size} nearby station(s) priced, ${dropped} implausible or stale price(s) left out.`,
    );
  } catch (error) {
    console.error("Fuel price sync error:", error);
  }
}
