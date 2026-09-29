import Feather from "@expo/vector-icons/Feather";
import { useMemo, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import { DentistStatus, NhsDentist } from "../app/types/nhsDentists";
import Button from "./Button";
import { GROUPS, StatusBadge } from "./DentistCard";

/**
 * Where the map can be shown. iOS uses Apple Maps, which needs no key.
 * Android uses Google Maps, which will not even open without an API key: add
 * one to the react-native-maps plugin in app.json (androidGoogleMapsApiKey),
 * rebuild, and add "android" here.
 */
export const MAP_AVAILABLE = Platform.OS === "ios";

const PIN_COLOURS: Record<DentistStatus, string> = {
  accepting: theme.colors.statusGreen,
  not_confirmed: theme.colors.statusAmber,
  not_accepting: theme.colors.neutral600,
  referral_only: theme.colors.neutral600,
};

const KEY = [
  { label: "Taking new patients", colour: PIN_COLOURS.accepting },
  { label: "Not confirmed", colour: PIN_COLOURS.not_confirmed },
  { label: "Not taking", colour: PIN_COLOURS.not_accepting },
];

// Stockton Heath, where the list is measured from - the fallback centre when
// no practice has a position yet.
const CENTRE = { latitude: 53.3705, longitude: -2.5811 };

type Located = NhsDentist & { latitude: number; longitude: number };

/** A map of the practices, with the tapped one's details over the bottom. */
export default function DentistMap({ dentists }: { dentists: NhsDentist[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const located = useMemo(
    () =>
      dentists.filter(
        (d): d is Located => d.latitude != null && d.longitude != null,
      ),
    [dentists],
  );

  // Frame every pin, with a margin so none sits on the edge.
  const region = useMemo(() => {
    if (located.length === 0) {
      return { ...CENTRE, latitudeDelta: 0.16, longitudeDelta: 0.25 };
    }
    const lats = located.map((d) => d.latitude);
    const lons = located.map((d) => d.longitude);
    const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
    const [minLon, maxLon] = [Math.min(...lons), Math.max(...lons)];
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: (maxLat - minLat) * 1.3 + 0.01,
      longitudeDelta: (maxLon - minLon) * 1.3 + 0.01,
    };
  }, [located]);

  const dentist = located.find((d) => d.odsCode === selected) ?? null;

  return (
    <View style={{ flex: 1, gap: 10 }}>
      <View style={styles.key}>
        {KEY.map(({ label, colour }) => (
          <View key={label} style={styles.keyItem}>
            <View style={[styles.keyDot, { backgroundColor: colour }]} />
            <Text style={[globalStyles.bodySmall, { fontSize: 13 }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.container}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          showsPointsOfInterest={false}
          toolbarEnabled={false}
          onPress={(event) => {
            // Tapping a pin also reports a press on the map; only a tap on
            // the map itself should close the panel.
            if (event.nativeEvent.action !== "marker-press") setSelected(null);
          }}
        >
          {located.map((d) => (
            <Marker
              key={d.odsCode}
              coordinate={{ latitude: d.latitude, longitude: d.longitude }}
              pinColor={PIN_COLOURS[d.status]}
              onPress={() => setSelected(d.odsCode)}
              accessibilityLabel={d.name}
            />
          ))}
        </MapView>

        {located.length < dentists.length && (
          <View style={styles.notice}>
            <Text
              style={[globalStyles.bodySmall, { fontSize: 12, lineHeight: 16 }]}
            >
              {dentists.length - located.length} practice
              {dentists.length - located.length === 1
                ? " isn't"
                : "s aren't"}{" "}
              on the map - see the list
            </Text>
          </View>
        )}

        {dentist && (
          <SelectedPractice
            dentist={dentist}
            onClose={() => setSelected(null)}
          />
        )}
      </View>
    </View>
  );
}

function SelectedPractice({
  dentist,
  onClose,
}: {
  dentist: NhsDentist;
  onClose: () => void;
}) {
  const groups = GROUPS.filter(({ key }) => dentist.accepting[key]).map(
    ({ label }) => label,
  );

  return (
    <View style={styles.panel}>
      <View style={styles.panelTitleRow}>
        <Text style={[globalStyles.cardTitle, { flex: 1 }]}>
          {dentist.name}
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Feather name="x" size={20} color={theme.colors.neutral700} />
        </Pressable>
      </View>
      <Text style={[globalStyles.bodySmall, globalStyles.bodyMuted]}>
        {dentist.address}
      </Text>
      <StatusBadge status={dentist.status} />
      {groups.length > 0 && (
        <Text style={globalStyles.bodySmall}>
          Taking new NHS patients who are{" "}
          <Text style={globalStyles.bodyBold}>{groups.join(", ")}</Text>
        </Text>
      )}
      <View style={styles.actions}>
        {dentist.phone && (
          <Button
            variant="primary"
            width="full"
            style={{ flex: 1 }}
            icon={<Feather name="phone" size={16} color={theme.colors.white} />}
            onPress={() =>
              void Linking.openURL(
                `tel:${dentist.phone!.replace(/\s/g, "")}`,
              ).catch(() => {})
            }
          >
            Call
          </Button>
        )}
        <Button
          variant="neutral"
          width="full"
          style={{ flex: 1 }}
          onPress={() => void Linking.openURL(dentist.nhsUrl).catch(() => {})}
        >
          NHS website
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  key: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 4,
  },
  keyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  keyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  container: {
    flex: 1,
    minHeight: 320,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: theme.colors.neutral300,
  },
  notice: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  panel: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: theme.colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  panelTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
});
