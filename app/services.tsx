import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { ScrollView } from "react-native";
import PostcodeSection from "../components/PostcodeSection";
import WasteCollectionSection from "../components/WasteCollectionSection";
import { theme } from "./styles/theme";
import { AddressesResponse, UPRN } from "./types/binCollections";

export default function Services() {
  const [loading, setLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<AddressesResponse>([]);
  const [userAddress, setUserAddress] = useState<{
    address: string;
    uprn: UPRN;
  } | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<{
    address: string;
    uprn: UPRN;
  } | null>(null);
  const [binCollections, setBinCollections] = useState<any>(null);

  const handleSetAddress = () => {
    if (!selectedAddress) return;
    setUserAddress(selectedAddress);
    AsyncStorage.setItem("userAddress", JSON.stringify(selectedAddress));
  };

  useEffect(() => {
    const loadStoredAddress = async () => {
      try {
        const stored = await AsyncStorage.getItem("userAddress");
        if (stored) setUserAddress(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to load stored address:", error);
      }
    };
    loadStoredAddress();
  }, []);

  const postcodeSearch = useCallback(async (postcode: string) => {
    const formatted = postcode.trim().toLowerCase().replace(/\s+/g, "");
    const url = `https://www.warrington.gov.uk/bin-collections/get-addresses/uprn/${formatted}`;
    setLoading(true);
    setSearchError(null);
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error("Could not find addresses for that postcode.");
      const data: AddressesResponse = await response.json();
      setAddresses(data);
      setSelectedAddress(null);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setAddresses([]);
    setSelectedAddress(null);
    setUserAddress(null);
  }, []);

  const fetchCollectionSchedule = useCallback(async () => {
    if (!userAddress) return;
    const url = `https://www.warrington.gov.uk/bin-collections/get-jobs/${userAddress.uprn}`;
    setLoading(true);
    try {
      const response = await fetch(url);
      const data = await response.json();
      setBinCollections(data);
      console.log("Collection schedule data:", data);
    } catch (error) {
      console.error("Failed to fetch collection schedule:", error);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 20, gap: 32 }}
      style={{ backgroundColor: theme.colors.neutral200, flex: 1 }}
    >
      <PostcodeSection
        onPostcodeSearch={postcodeSearch}
        addresses={addresses}
        userAddress={userAddress}
        selectedAddress={selectedAddress}
        onSelectAddress={setSelectedAddress}
        onFetchCollectionSchedule={fetchCollectionSchedule}
        onSetAddress={handleSetAddress}
        onReset={handleReset}
        loading={loading}
        error={searchError}
      />
      <WasteCollectionSection
        binCollectionsData={binCollections}
        isLoading={loading}
      />
    </ScrollView>
  );
}
