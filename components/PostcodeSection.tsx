import { Feather, Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import { AddressesResponse, UPRN } from "../app/types/binCollections";
import Button from "./Button";
import PostcodeInput from "./PostcodeInput";

interface PostcodeSectionProps {
  onPostcodeSearch: (postcode: string) => void;
  addresses: AddressesResponse;
  userAddress: { address: string; uprn: UPRN } | null;
  selectedAddress: { address: string; uprn: UPRN } | null;
  onSelectAddress: (address: { address: string; uprn: UPRN } | null) => void;
  onSetAddress: (address: { address: string; uprn: UPRN } | null) => void;
  onFetchCollectionSchedule: () => void;
  onReset: () => void;
  loading: boolean;
  error: string | null;
}

export default function PostcodeSection({
  onFetchCollectionSchedule,
  onReset,
  onSelectAddress,
  ...props
}: PostcodeSectionProps) {
  const [postcode, setPostcode] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!props.userAddress) return;

    onFetchCollectionSchedule();
  }, [onFetchCollectionSchedule, props.userAddress]);

  useEffect(() => {
    if (!postcode) {
      onSelectAddress(null);
    }
  }, [onSelectAddress, postcode]);

  return (
    <View style={{ gap: 32 }}>
      {props.userAddress ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="home" size={18} color={theme.colors.primary} />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                globalStyles.body,
                globalStyles.bodyBold,
                { flex: 1, marginHorizontal: 8 },
              ]}
            >
              {props.userAddress.address}
            </Text>
            <Button
              size="small"
              variant="neutral"
              style={{ marginLeft: "auto" }}
              icon={
                <Feather name="edit" size={16} color={theme.colors.primary} />
              }
              onPress={() => {
                setPostcode("");
                onReset();
              }}
            >
              Edit
            </Button>
          </View>
        </>
      ) : (
        <View>
          <Text style={[globalStyles.heading, globalStyles.headingBold]}>
            Your local service guide
          </Text>
          <Text style={[globalStyles.body, { marginTop: 8, marginBottom: 16 }]}>
            Enter your postcode to see local collection schedules.
          </Text>
          <PostcodeInput
            postcode={postcode}
            onChangePostcode={(value) => {
              setPostcode(value);
            }}
            onSearch={() => props?.onPostcodeSearch(postcode)}
            loading={props.loading}
            error={props.error}
          />
          {props.addresses.length > 0 && (
            <View style={{ position: "relative", marginVertical: 16 }}>
              <Ionicons
                name="home"
                size={20}
                color={theme.colors.neutral400}
                style={{
                  position: "absolute",
                  left: 16,
                  top: 16,
                  zIndex: 99999,
                }}
              />
              <DropDownPicker
                open={dropdownOpen}
                setOpen={setDropdownOpen}
                value={props.selectedAddress?.uprn ?? null}
                setValue={(val) => {
                  const uprn =
                    typeof val === "function"
                      ? val(props.selectedAddress?.uprn ?? null)
                      : val;
                  const item = props.addresses.find(
                    (entry) => Object.values(entry)[0] === uprn,
                  );
                  const address = item ? Object.keys(item)[0] : "";
                  onSelectAddress(uprn ? { address, uprn } : null);
                }}
                items={props.addresses.map((entry) => {
                  const address = Object.keys(entry)[0];
                  return { label: address, value: entry[address] };
                })}
                placeholder="Select your address..."
                listMode="SCROLLVIEW"
                style={{
                  backgroundColor: theme.colors.white,
                  borderWidth: 0,
                  borderRadius: 16,
                  paddingLeft: 48,
                  paddingRight: 16,
                  minHeight: 52,
                }}
                dropDownContainerStyle={{
                  backgroundColor: theme.colors.white,
                  borderWidth: 0,
                  borderRadius: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 4,
                }}
                textStyle={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes.body,
                  color: theme.colors.neutral1000,
                }}
                placeholderStyle={{
                  color: theme.colors.neutral600,
                }}
                selectedItemContainerStyle={{
                  backgroundColor: theme.colors.green100,
                }}
                selectedItemLabelStyle={{
                  color: theme.colors.green800,
                  fontFamily: theme.fonts.body,
                }}
                listItemLabelStyle={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes.body,
                }}
              />
            </View>
          )}
          {props.addresses.length > 0 && (
            <Button
              variant="tertiary"
              width="full"
              onPress={() => props.onSetAddress(props.selectedAddress)}
              disabled={!props.selectedAddress}
            >
              Set Address
            </Button>
          )}
        </View>
      )}
    </View>
  );
}
