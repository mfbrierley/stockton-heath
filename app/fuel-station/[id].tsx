import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BackHeader from "../../components/BackHeader";
import Button from "../../components/Button";
import SourceNote from "../../components/SourceNote";
import StationMap from "../../components/StationMap";
import {
  findStation,
  StationPrices,
  useFuelPrices,
} from "../../hooks/useFuelPrices";
import { FUEL_FINDER_URL } from "../../utils/dataSources";
import { globalStyles } from "../styles/globalStyles";
import { theme } from "../styles/theme";

const FUELS = [
  { type: "E10", label: "Petrol E10" },
  { type: "B7_STANDARD", label: "Diesel B7" },
];

/**
 * Driving directions in the phone's own maps app: Apple Maps on iPhone,
 * Google Maps on Android. Both links open the app when it is installed and
 * the website when it isn't.
 */
function directionsUrl(latitude: number, longitude: number): string {
  const destination = `${latitude},${longitude}`;
  return Platform.OS === "ios"
    ? `https://maps.apple.com/?daddr=${destination}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

function formatUpdated(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Updated ${day} at ${time}`;
}

/** A fuel station from the Home screen's list, with a map and directions. */
export default function FuelStation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { prices, loading, error } = useFuelPrices();
  const station = findStation(prices, id);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.neutral200 }}>
      <BackHeader />
      {station ? (
        <StationDetails station={station} />
      ) : (
        <View style={{ padding: 16 }}>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text style={globalStyles.body}>
              {error && !prices
                ? error
                : "This station is no longer in the list. Go back to see the latest prices."}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function StationDetails({ station }: { station: StationPrices }) {
  const { latitude, longitude } = station;
  const phone = station.public_phone_number?.trim();
  const amenities = station.amenities ?? [];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
    >
      <View>
        <Text style={[globalStyles.heading, globalStyles.headingBold]}>
          {station.display_name}
        </Text>
        <Text
          style={[globalStyles.body, globalStyles.bodyMuted, { marginTop: 6 }]}
        >
          {station.address || station.location}
        </Text>
      </View>

      {latitude != null && longitude != null && (
        <>
          <StationMap latitude={latitude} longitude={longitude} />
          <Button
            variant="primary"
            width="full"
            icon={
              <Feather name="navigation" size={16} color={theme.colors.white} />
            }
            onPress={() =>
              void Linking.openURL(directionsUrl(latitude, longitude)).catch(
                () => {},
              )
            }
          >
            Get directions
          </Button>
        </>
      )}

      {phone ? (
        <Button
          variant="neutral"
          width="full"
          icon={
            <Feather name="phone" size={16} color={theme.colors.neutral1000} />
          }
          onPress={() =>
            void Linking.openURL(`tel:${phone.replace(/\s/g, "")}`).catch(
              () => {},
            )
          }
        >
          {`Call ${phone}`}
        </Button>
      ) : null}

      {/* Prices */}
      <View
        style={[globalStyles.card, globalStyles.cardWhite, globalStyles.cardList]}
      >
        <View style={globalStyles.cardListHeader}>
          <Text
            style={[
              globalStyles.body,
              globalStyles.bodyBold,
              globalStyles.cardListHeaderText,
            ]}
          >
            Prices
          </Text>
        </View>
        <View style={styles.cardBody}>
          {FUELS.map(({ type, label }, i) => {
            const price = station.fuel_prices.find((p) => p.fuel_type === type);
            const updated = price ? formatUpdated(price.price_last_updated) : null;
            return (
              <View key={type}>
                {i > 0 && <View style={globalStyles.divider} />}
                <View style={[globalStyles.rowSpaceBetween, styles.row]}>
                  <Text style={globalStyles.body}>{label}</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.price}>
                      {price ? `${price.price}p` : "-"}
                    </Text>
                    {updated && (
                      <Text
                        style={[globalStyles.bodySmall, globalStyles.bodyMuted]}
                      >
                        {updated}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* About the station */}
      {(station.distance_miles != null || amenities.length > 0) && (
        <View
          style={[
            globalStyles.card,
            globalStyles.cardWhite,
            globalStyles.cardList,
          ]}
        >
          <View style={globalStyles.cardListHeader}>
            <Text
              style={[
                globalStyles.body,
                globalStyles.bodyBold,
                globalStyles.cardListHeaderText,
              ]}
            >
              About this station
            </Text>
          </View>
          <View style={styles.cardBody}>
            {station.distance_miles != null && (
              <View style={[globalStyles.rowSpaceBetween, styles.row]}>
                <Text style={globalStyles.body}>From Stockton Heath</Text>
                <Text style={[globalStyles.body, globalStyles.bodyBold]}>
                  {`${station.distance_miles} ${station.distance_miles === 1 ? "mile" : "miles"}`}
                </Text>
              </View>
            )}
            {station.distance_miles != null && amenities.length > 0 && (
              <View style={globalStyles.divider} />
            )}
            {amenities.length > 0 && (
              <View style={[styles.row, { gap: 10 }]}>
                <Text style={globalStyles.body}>Facilities</Text>
                <View style={styles.amenities}>
                  {amenities.map((amenity, i) => (
                    <View key={`${i}-${amenity}`} style={styles.amenity}>
                      <Text style={globalStyles.bodySmall}>{amenity}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      <SourceNote
        label="Prices and station details from the UK Government's Fuel Finder scheme. Source:"
        url={FUEL_FINDER_URL}
        androidOnly
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardBody: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  row: {
    paddingVertical: 12,
  },
  price: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 20,
    color: theme.colors.neutral1100,
  },
  amenities: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  amenity: {
    backgroundColor: theme.colors.neutral200,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
