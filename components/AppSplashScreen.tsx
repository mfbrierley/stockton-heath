import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { theme } from "../app/styles/theme";
import RowswoodLogo from "../assets/images/Rowswood-Timber-Logo.svg";

type Props = {
  visible: boolean;
  onHidden: () => void;
};

export function AppSplashScreen({ visible, onHidden }: Props) {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => onHidden());
    }
  }, [visible, fadeAnim, onHidden]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.green800]}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Text style={styles.title}>StocktonHeath</Text>
        <View style={styles.sponsorContainer}>
          <Text style={styles.sponsoredBy}>sponsored by</Text>
          <RowswoodLogo width={200} height={60} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 36,
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
  sponsorContainer: {
    alignItems: "center",
    marginTop: 32,
    gap: 8,
  },
  sponsoredBy: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.white,
    opacity: 1,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
