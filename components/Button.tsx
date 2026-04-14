import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
} from "react-native";
import { theme } from "../app/styles/theme";

type Variant = "primary" | "secondary" | "tertiary" | "neutral" | "ghost";
type Width = "full" | "auto";
type Size = "large" | "small";

interface ButtonProps extends PressableProps {
  children?: string;
  variant?: Variant;
  width?: Width;
  size?: Size;
  square?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<
  Variant,
  { background: string | undefined; text: string }
> = {
  primary: { background: theme.colors.primary, text: theme.colors.white },
  secondary: { background: theme.colors.secondary, text: theme.colors.white },
  tertiary: { background: theme.colors.tertiary, text: theme.colors.white },
  neutral: {
    background: theme.colors.neutral300,
    text: theme.colors.neutral1000,
  },
  ghost: { background: undefined, text: theme.colors.neutral1000 },
};

export default function Button({
  children,
  variant = "primary",
  width = "auto",
  size = "large",
  square = false,
  loading = false,
  icon,
  style,
  ...pressableProps
}: ButtonProps) {
  const { background, text } = variantStyles[variant];
  const isDisabled = loading || !!pressableProps.disabled;

  return (
    <Pressable
      {...pressableProps}
      disabled={isDisabled}
      style={[
        styles.base,
        square
          ? size === "large"
            ? styles.squareLarge
            : styles.squareSmall
          : size === "large"
            ? styles.sizeLarge
            : styles.sizeSmall,
        background ? { backgroundColor: background } : undefined,
        !square && width === "full" ? styles.fullWidth : styles.autoWidth,
        isDisabled ? styles.disabled : undefined,
        typeof style === "function" ? undefined : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={text} />
      ) : (
        <>
          {icon}
          {!square && children && (
            <Text
              style={[
                styles.label,
                size === "small" ? styles.labelSmall : undefined,
                { color: text },
              ]}
            >
              {children}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
  },
  sizeLarge: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  sizeSmall: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
  },
  squareLarge: {
    borderRadius: 16,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  squareSmall: {
    borderRadius: 8,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: {
    justifyContent: "center",
  },
  autoWidth: {
    alignSelf: "flex-start",
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.body,
    fontWeight: theme.fontWeights.regular,
  },
  labelSmall: {
    fontSize: theme.fontSizes.body,
  },
});
