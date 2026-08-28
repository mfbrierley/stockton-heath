import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { BusinessListing } from "../app/types/businessListing";

// What residents are shown on the Discounts tab: every listing that is both
// approved and paid for, which is the filter the backend applies for us.
//
// Deliberately not cached in AsyncStorage, unlike bin collections. A listing
// leaves the app the moment its discount or photo is edited - that sends it
// back to be read again - and removing one deletes the row outright. A cached
// copy would go on advertising a discount the business has already withdrawn,
// in a shop that would then have to honour it.
export function useBusinessListings() {
  const [listings, setListings] = useState<BusinessListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Two things start a fetch - opening the tab and pulling down - so a slow
  // earlier response can land after a quick later one. Only the newest request
  // is allowed to write, which also covers the unmount case the rest of the
  // app handles with an isMounted flag.
  const latestRequest = useRef(0);

  const fetchListings = useCallback(async () => {
    const request = ++latestRequest.current;

    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!backendUrl) throw new Error("EXPO_PUBLIC_BACKEND_URL is not set");

      const res = await fetch(`${backendUrl}/business-listings`);
      if (!res.ok) throw new Error(`${res.status}`);

      const json = (await res.json()) as BusinessListing[];
      if (request !== latestRequest.current) return;

      setListings(Array.isArray(json) ? json : []);
      setError(null);
    } catch (err) {
      if (request !== latestRequest.current) return;
      // The real reason goes to the console for whoever is testing; residents
      // get something they can act on. The screen only shows this when there
      // is nothing else to show - a failed refresh leaves the list alone.
      console.error("Failed to load business listings:", err);
      setError("Could not load discounts. Pull down to try again.");
    } finally {
      if (request === latestRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // The only trigger. useFocusEffect runs on the first focus as well as every
  // return to the tab, so there is no separate mount fetch to double up with -
  // and coming back to the tab is exactly when a withdrawn discount should
  // disappear. `loading` is only ever true for the first one, so a refocus
  // refreshes underneath the list rather than replacing it with a spinner.
  useFocusEffect(
    useCallback(() => {
      void fetchListings();
    }, [fetchListings]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void fetchListings();
  }, [fetchListings]);

  return { listings, loading, refreshing, error, refresh };
}
