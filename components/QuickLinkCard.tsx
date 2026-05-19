import Feather from "@expo/vector-icons/Feather";
import {
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";

interface QuickLinkCardProps extends PressableProps {
  icon: React.ReactNode;
  title: string;
}

export default function QuickLinkCard({
  icon,
  title,
  style,
  ...pressableProps
}: QuickLinkCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        typeof style === "function" ? undefined : style,
      ]}
      {...pressableProps}
    >
      <View style={styles.iconContainer}>{icon}</View>
      <Text style={[globalStyles.body, globalStyles.bodyBold, styles.title]}>
        {title}
      </Text>
      <Feather name="chevron-right" size={20} color={theme.colors.neutral600} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 18,
  },
  pressed: {
    opacity: 0.75,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.green100,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    color: theme.colors.green1000,
  },
});
