import { Text, View } from "react-native";
import { theme } from "./styles/theme";

export default function Bridge() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.neutral200,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Welcome to the Bridge page!</Text>
    </View>
  );
}
