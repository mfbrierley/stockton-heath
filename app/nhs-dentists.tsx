import { Ionicons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BackHeader from "../components/BackHeader";
import Button from "../components/Button";
import DentistCard from "../components/DentistCard";
import DentistMap, { MAP_AVAILABLE } from "../components/DentistMap";
import SourceNote from "../components/SourceNote";
import {
  NHS_FIND_A_DENTIST_RESULTS_URL,
  NHS_FIND_A_DENTIST_URL,
} from "../utils/dataSources";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";
import { NhsDentistsResponse } from "./types/nhsDentists";

type Mode = "list" | "map";

const MODES: { key: Mode; label: string; icon: "list" | "map" }[] = [
  { key: "list", label: "List", icon: "list" },
  { key: "map", label: "Map", icon: "map" },
];

// The backend reads nhs.uk daily and retries hourly, so a list this old means
// it has been failing for days.
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

const formatChecked = (fetchedAt: number) => {
  const date = new Date(fetchedAt);
  const day = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} at ${time}`;
};

export default function NhsDentists() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<NhsDentistsResponse | null>(null);
  const [mode, setMode] = useState<Mode>("list");

  useEffect(() => {
    let isMounted = true;

    async function fetchDentists() {
      try {
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
        if (!backendUrl) throw new Error("EXPO_PUBLIC_BACKEND_URL is not set");

        const res = await fetch(`${backendUrl}/nhs-dentists`);
        if (res.status === 503)
          throw new Error("The dentist list is loading, try again shortly");
        if (!res.ok) throw new Error(`${res.status}`);

        const json = (await res.json()) as NhsDentistsResponse;
        if (isMounted) setResponse(json);
      } catch (err) {
        if (isMounted)
          setError(
            err instanceof Error ? err.message : "Failed to load NHS dentists",
          );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchDentists();
    return () => {
      isMounted = false;
    };
  }, []);

  const dentists = response?.data ?? [];
  const stale =
    response !== null && Date.now() - response.fetchedAt > STALE_AFTER_MS;

  // Shared by both views, so switching between them keeps the top in place.
  const top = (
    <>
      <View>
        <Text style={[globalStyles.heading, globalStyles.headingBold]}>
          NHS Dentists
        </Text>
        <Text
          style={[globalStyles.body, globalStyles.bodyMuted, { marginTop: 6 }]}
        >
          Browse NHS dental practices within 5 miles of Stockton Heath, and see
          whether they are taking on new NHS patients
        </Text>
        {/* Google Play rejected 1.0.7 when the only NHS link was at the foot
            of the list: the source has to be visible without scrolling. */}
        <View style={{ marginTop: 4 }}>
          <SourceNote
            label="Source:"
            url={NHS_FIND_A_DENTIST_URL}
            linkText="nhs.uk"
          />
        </View>
      </View>

      {MAP_AVAILABLE && (
        <View style={styles.toggle} accessibilityRole="tablist">
          {MODES.map(({ key, label, icon }) => {
            const selected = key === mode;
            const colour = selected ? theme.colors.white : theme.colors.green1000;
            return (
              <Pressable
                key={key}
                onPress={() => setMode(key)}
                style={[styles.toggleOption, selected && styles.toggleSelected]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Feather name={icon} size={16} color={colour} />
                <Text
                  style={[
                    globalStyles.bodySmall,
                    globalStyles.bodyBold,
                    { color: colour },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {stale && response && (
        <View style={styles.warning}>
          <Ionicons
            name="warning"
            size={16}
            color={theme.colors.statusAmber}
            style={{ marginTop: 3 }}
          />
          <Text
            style={[globalStyles.body, globalStyles.bodyBold, styles.warningText]}
          >
            This list has not been updated from the NHS website since{" "}
            {formatChecked(response.fetchedAt)}, so it is more likely to be out
            of date. Check with the practice, or search the NHS website.
          </Text>
        </View>
      )}
    </>
  );

  const status = loading ? (
    <ActivityIndicator style={{ marginVertical: 24 }} />
  ) : error ? (
    <Text style={[globalStyles.body, { color: theme.colors.statusRed }]}>
      {error}
    </Text>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.neutral200 }}>
      <BackHeader />
      {mode === "map" && MAP_AVAILABLE ? (
        // Not in a ScrollView: the map takes the rest of the screen, and a
        // map inside a scrolling page fights it for every drag.
        <View style={styles.mapScreen}>
          {top}
          {status ?? <DentistMap dentists={dentists} />}
          <SourceNote
            label="Practice details from the NHS website and pin positions from ONS postcode data, both under the Open Government Licence v3.0. Pins are placed by postcode, so are approximate. Map © OpenStreetMap contributors. This is an unofficial app, not the NHS. Source:"
            url={NHS_FIND_A_DENTIST_URL}
          />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        >
          {top}

          {status ??
            (dentists.length === 0 ? (
              <Text style={[globalStyles.body, globalStyles.bodyMuted]}>
                No practices found.
              </Text>
            ) : (
              dentists.map((dentist) => (
                <DentistCard key={dentist.odsCode} dentist={dentist} />
              ))
            ))}

          <SourceNote
            label={`Information from the NHS website, licensed under the Open Government Licence v3.0. This is an unofficial app, not the NHS. Checked once a day${
              response ? `, last on ${formatChecked(response.fetchedAt)}` : ""
            }. Source:`}
            url={NHS_FIND_A_DENTIST_URL}
          />

          <Button
            variant="primary"
            width="full"
            onPress={() =>
              void Linking.openURL(NHS_FIND_A_DENTIST_RESULTS_URL).catch(() => {})
            }
          >
            Search on the NHS website
          </Button>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  toggle: {
    flexDirection: "row",
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.neutral300,
    borderRadius: 22,
    padding: 4,
  },
  toggleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 18,
  },
  toggleSelected: {
    backgroundColor: theme.colors.primary,
  },
  mapScreen: {
    flex: 1,
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
});
