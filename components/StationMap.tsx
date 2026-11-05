import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
} from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "../app/styles/theme";
import { MAP_STYLE } from "./DentistMap";

/**
 * One fuel station on the same MapLibre / OpenFreeMap map as the dentists
 * (see DentistMap.tsx for why), zoomed in far enough to read the streets
 * around it.
 */
export default function StationMap({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const point = useMemo(
    (): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [longitude, latitude] },
        },
      ],
    }),
    [latitude, longitude],
  );

  return (
    <View style={styles.container}>
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE}
        // The "© OpenStreetMap" credit OpenFreeMap requires.
        attribution
        logo={false}
        compass={false}
        touchPitch={false}
      >
        <Camera initialViewState={{ center: [longitude, latitude], zoom: 15 }} />
        <GeoJSONSource id="station" data={point}>
          <Layer
            id="station-pin"
            type="circle"
            paint={{
              "circle-color": theme.colors.primary,
              "circle-radius": 10,
              "circle-stroke-color": theme.colors.white,
              "circle-stroke-width": 3,
            }}
          />
        </GeoJSONSource>
      </MapLibreMap>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 240,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: theme.colors.neutral300,
  },
});
