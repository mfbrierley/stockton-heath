import Feather from "@expo/vector-icons/Feather";
import { useMemo, useState } from "react";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  type LngLatBounds,
} from "@maplibre/maplibre-react-native";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import { DentistStatus, NhsDentist } from "../app/types/nhsDentists";
import Button from "./Button";
import { GROUPS, StatusBadge } from "./DentistCard";

/**
 * The map is MapLibre, open source and the same on iOS and Android, drawing
 * OpenStreetMap data served by OpenFreeMap: free, no API key, no account.
 * MapLibre shows the "© OpenStreetMap" credit the data needs by itself, from
 * the style. OpenFreeMap is run on donations with no uptime promise; if it is
 * ever down the map is blank and the list still works, and another provider
 * (MapTiler, Stadia, or self-hosted tiles) is a change to this one URL.
 */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export const MAP_AVAILABLE = true;

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

// Roughly 5 miles around Stockton Heath - the fallback view when no practice
// has a position yet. [west, south, east, north]
const AREA: LngLatBounds = [-2.7, 53.3, -2.46, 53.44];

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

  // Frame every pin; the camera's padding keeps them off the edges.
  const bounds = useMemo((): LngLatBounds => {
    if (located.length === 0) return AREA;
    const lats = located.map((d) => d.latitude);
    const lons = located.map((d) => d.longitude);
    // A little extra so a lone pin doesn't zoom the map right in.
    const margin = 0.005;
    return [
      Math.min(...lons) - margin,
      Math.min(...lats) - margin,
      Math.max(...lons) + margin,
      Math.max(...lats) + margin,
    ];
  }, [located]);

  // One point per practice. Drawn as a single circle layer, coloured by
  // status from the feature's properties, rather than one view per pin.
  const points = useMemo(
    (): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: located.map((d) => ({
        type: "Feature",
        properties: { odsCode: d.odsCode, status: d.status },
        geometry: { type: "Point", coordinates: [d.longitude, d.latitude] },
      })),
    }),
    [located],
  );

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
        <MapLibreMap
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_STYLE}
          // The "© OpenStreetMap" credit OpenFreeMap requires.
          attribution
          logo={false}
          compass={false}
          touchPitch={false}
          // A tap that isn't on a pin closes the panel. Taps on pins stop
          // here, in the source's onPress, so never reach this.
          onPress={() => setSelected(null)}
        >
          <Camera
            initialViewState={{
              bounds,
              padding: { top: 48, right: 40, bottom: 48, left: 40 },
            }}
          />
          <GeoJSONSource
            id="dentists"
            data={points}
            hitbox={{ top: 16, right: 16, bottom: 16, left: 16 }}
            onPress={(event) => {
              event.stopPropagation();
              const odsCode =
                event.nativeEvent.features[0]?.properties?.odsCode;
              if (typeof odsCode === "string") setSelected(odsCode);
            }}
          >
            <Layer
              id="dentist-pins"
              type="circle"
              paint={{
                "circle-color": [
                  "match",
                  ["get", "status"],
                  "accepting",
                  PIN_COLOURS.accepting,
                  "not_confirmed",
                  PIN_COLOURS.not_confirmed,
                  PIN_COLOURS.not_accepting,
                ],
                "circle-radius": [
                  "case",
                  ["==", ["get", "odsCode"], selected ?? ""],
                  12,
                  8,
                ],
                "circle-stroke-color": theme.colors.white,
                "circle-stroke-width": 2.5,
              }}
            />
          </GeoJSONSource>
        </MapLibreMap>

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
