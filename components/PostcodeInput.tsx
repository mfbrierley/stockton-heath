import { Feather, Ionicons } from "@expo/vector-icons";
import { Pressable, Text, TextInput, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import Button from "./Button";

interface Props {
  postcode: string;
  onChangePostcode: (value: string) => void;
  onSearch: () => void;
  loading: boolean;
  error?: string | null;
}

export default function PostcodeInput({
  postcode,
  onChangePostcode,
  onSearch,
  loading,
  error,
}: Props) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.colors.white,
            borderRadius: 16,
          }}
        >
          <TextInput
            placeholder="Postcode"
            placeholderTextColor={theme.colors.neutral600}
            value={postcode}
            onChangeText={onChangePostcode}
            autoCapitalize="characters"
            style={{
              flex: 1,
              padding: 16,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes.body,
              color: theme.colors.neutral1000,
            }}
          />
          {postcode.length > 0 && (
            <Pressable
              onPress={() => onChangePostcode("")}
              style={{ marginRight: 8 }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.colors.neutral600}
              />
            </Pressable>
          )}
        </View>
        <Button
          variant="tertiary"
          loading={loading}
          onPress={onSearch}
          square={true}
          icon={<Feather name="search" size={16} color={theme.colors.white} />}
        />
      </View>
      {error && (
        <Text style={[globalStyles.body, { color: theme.colors.statusRed }]}>
          {error}
        </Text>
      )}
    </View>
  );
}
