import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";

export default function BackHeader({ label = "Back" }: { label?: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => router.back()} style={globalStyles.backButton}>
        <Ionicons name="chevron-back" size={18} color={theme.colors.green800} />
        <Text
          style={[
            globalStyles.body,
            globalStyles.bodyBold,
            globalStyles.bodyLink,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.neutral100,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});
