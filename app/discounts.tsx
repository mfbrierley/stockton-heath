import { Text, View } from "react-native";
import { theme } from "./styles/theme";

export default function Discounts() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.neutral200,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Welcome to the Discounts page!</Text>
    </View>
  );
}
