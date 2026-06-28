import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { theme } from "../app/styles/theme";

type Props = {
  visible: boolean;
  onHidden: () => void;
};

export function AppSplashScreen({ visible, onHidden }: Props) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const gradientAnim = useRef(new Animated.Value(0)).current;

  // Continuously shift between two diagonal gradients
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(gradientAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [gradientAnim]);

  // Fade the whole splash out when visible becomes false
  useEffect(() => {
    if (!visible) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }).start(() => onHidden());
    }
  }, [visible, fadeAnim, onHidden]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
      <StatusBar style="light" />
      {/* Base gradient */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.green800]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Animated overlay gradient — cross-fades to create movement */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: gradientAnim }]}
      >
        <LinearGradient
          colors={[theme.colors.green800, theme.colors.secondary]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={styles.content}>
        <Text style={styles.title}>StocktonHeath</Text>
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
});
