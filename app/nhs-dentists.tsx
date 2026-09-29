import { Ionicons } from "@expo/vector-icons";
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
import SourceNote from "../components/SourceNote";
import {
  NHS_FIND_A_DENTIST_RESULTS_URL,
  NHS_FIND_A_DENTIST_URL,
} from "../utils/dataSources";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";
import { NhsDentist, NhsDentistsResponse } from "./types/nhsDentists";

type Filter = "all" | "adults" | "children";

// The backend reads nhs.uk daily and retries hourly, so a list this old means
// it has been failing for days.
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

const FILTERS: {
  key: Filter;
  label: string;
  matches: (d: NhsDentist) => boolean;
  empty: string;
}[] = [
  {
    key: "all",
    label: "All",
    matches: () => true,
    empty: "No practices found.",
  },
  {
    key: "adults",
    label: "Adults",
    matches: (d) => d.accepting.adults,
    empty:
      "None of these practices say they are taking on new NHS patients aged 18 or over right now.",
  },
  {
    key: "children",
    label: "Children",
    matches: (d) => d.accepting.children,
    empty:
      "None of these practices say they are taking on new NHS patients aged 17 or under right now.",
  },
];

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
  const [filter, setFilter] = useState<Filter>("all");

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
  const active = FILTERS.find((f) => f.key === filter)!;
  const shown = dentists.filter(active.matches);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.neutral200 }}>
      <BackHeader />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: 40,
        }}
      >
        <View>
          <Text style={[globalStyles.heading, globalStyles.headingBold]}>
            NHS Dentists
          </Text>
          <Text
            style={[
              globalStyles.body,
              globalStyles.bodyMuted,
              { marginTop: 6 },
            ]}
          >
            Browse NHS dental practices within 5 miles of Stockton Heath, and
            see whether they are taking on new NHS patients
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} />
        ) : error ? (
          <Text style={[globalStyles.body, { color: theme.colors.statusRed }]}>
            {error}
          </Text>
        ) : (
          <>
            {response && Date.now() - response.fetchedAt > STALE_AFTER_MS && (
              <View style={styles.warning}>
                <Ionicons
                  name="warning"
                  size={16}
                  color={theme.colors.statusAmber}
                  style={{ marginTop: 3 }}
                />
                <Text
                  style={[
                    globalStyles.body,
                    globalStyles.bodyBold,
                    styles.warningText,
                  ]}
                >
                  This list has not been updated from the NHS website since{" "}
                  {formatChecked(response.fetchedAt)}, so it is more likely to
                  be out of date. Check with the practice, or search the NHS
                  website below.
                </Text>
              </View>
            )}

            <View style={styles.filters} accessibilityRole="tablist">
              {FILTERS.map(({ key, label, matches }) => {
                const selected = key === filter;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setFilter(key)}
                    style={[styles.chip, selected && styles.chipSelected]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        globalStyles.bodySmall,
                        globalStyles.bodyBold,
                        { color: selected ? theme.colors.white : theme.colors.green1000 },
                      ]}
                    >
                      {label} ({dentists.filter(matches).length})
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {shown.length === 0 ? (
              <Text style={[globalStyles.body, globalStyles.bodyMuted]}>
                {active.empty}
              </Text>
            ) : (
              shown.map((dentist) => (
                <DentistCard key={dentist.odsCode} dentist={dentist} />
              ))
            )}
          </>
        )}

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
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.neutral300,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
});
