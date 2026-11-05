import { Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";

// MapLibre React Native has no web version, and the app is not published on
// the web. This stands in so the screen can be previewed with
// `expo start --web`; the map itself only exists in the phone apps.
export default function StationMap(_: { latitude: number; longitude: number }) {
  return (
    <View
      style={{
        height: 240,
        borderRadius: 24,
        backgroundColor: theme.colors.neutral300,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text style={[globalStyles.body, { textAlign: "center" }]}>
        The map shows in the app on iPhone and Android.
      </Text>
    </View>
  );
}
