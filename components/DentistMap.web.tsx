import { Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import { NhsDentist } from "../app/types/nhsDentists";

// MapLibre React Native has no web version, and the app is not published on
// the web. The toggle is still offered there so the screen can be previewed
// with `expo start --web`; the map itself only exists in the phone apps.
export const MAP_AVAILABLE = true;

export default function DentistMap({ dentists }: { dentists: NhsDentist[] }) {
  const located = dentists.filter((d) => d.latitude != null).length;
  return (
    <View
      style={{
        flex: 1,
        minHeight: 320,
        borderRadius: 16,
        backgroundColor: theme.colors.neutral300,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text style={[globalStyles.body, { textAlign: "center" }]}>
        The map shows in the app on iPhone and Android ({located} of{" "}
        {dentists.length} practices have a position).
      </Text>
    </View>
  );
}
