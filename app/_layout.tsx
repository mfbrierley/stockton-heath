import { WelcomeNamePrompt } from "@/components/WelcomeNamePrompt";
import {
  NotoSerif_400Regular,
  NotoSerif_700Bold,
} from "@expo-google-fonts/noto-serif";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import type { ReactElement } from "react";
import { cloneElement, useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { AppSplashScreen } from "../components/AppSplashScreen";
import { UserNameProvider, useUserName } from "../hooks/useUserName";
import { theme } from "./styles/theme";

export const ACTIVE_CLOSURE_KEY = "activeBridgeClosure";

// Hard rule: text never scales with OS accessibility (Dynamic Type / "Larger
// Text"). Patching the component's render forces `allowFontScaling: false` on
// every Text/TextInput and cannot be overridden by a component-level prop,
// unlike `defaultProps` (which is also being deprecated by React).
type PatchableComponent = {
  render?: (...args: unknown[]) => ReactElement<Record<string, unknown>>;
  __noFontScalingPatched?: boolean;
};

const enforceNoFontScaling = (component: unknown) => {
  const target = component as PatchableComponent;
  if (target.__noFontScalingPatched) return; // avoid re-wrapping on fast refresh
  const originalRender = target.render;
  if (typeof originalRender !== "function") return;
  target.render = function patchedRender(...args: unknown[]) {
    return cloneElement(originalRender.apply(this, args), {
      allowFontScaling: false,
    });
  };
  target.__noFontScalingPatched = true;
};

enforceNoFontScaling(Text);
enforceNoFontScaling(TextInput);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  return (
    <UserNameProvider>
      <RootLayoutInner />
    </UserNameProvider>
  );
}

function RootLayoutInner() {
  const [fontsLoaded] = useFonts({
    NotoSerif: NotoSerif_400Regular,
    NotoSerifBold: NotoSerif_700Bold,
    PlusJakartaSans: PlusJakartaSans_400Regular,
    PlusJakartaSansBold: PlusJakartaSans_700Bold,
  });
  const { loading, markWelcomeCompleted, setFirstName, welcomeCompleted } =
    useUserName();
  const [showSplash, setShowSplash] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
      setShowSplash(true);
      const timer = setTimeout(() => setSplashVisible(false), 3000); // TODO: revert to 4000
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

  const handledResponseIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleNotificationResponse = (
      response: Notifications.NotificationResponse,
    ) => {
      // A cold-start tap can be delivered by both getLastNotificationResponseAsync
      // and the live listener, so dedupe on the notification identifier.
      const identifier = response.notification.request.identifier;
      if (handledResponseIds.current.has(identifier)) return;
      handledResponseIds.current.add(identifier);

      const data = response.notification.request.content.data as {
        tweetId?: string;
        firstBridge?: string | null;
        closureMinutes?: number | null;
        sentAt?: number;
      };

      if (!data?.tweetId) return;

      const closureMinutes =
        typeof data.closureMinutes === "number" ? data.closureMinutes : 45;
      const notificationSentAt =
        typeof data.sentAt === "number" ? data.sentAt : Date.now();
      const expiresAt = notificationSentAt + (closureMinutes + 15) * 60 * 1000;

      // Only store the active-closure banner if the window hasn't already passed.
      if (Date.now() <= expiresAt) {
        void AsyncStorage.setItem(
          ACTIVE_CLOSURE_KEY,
          JSON.stringify({
            firstBridge: data.firstBridge ?? null,
            expiresAt,
          }),
        );
      }

      router.push("/(tabs)/bridge");
    };

    // Warm taps: app already running in the foreground or background.
    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    // Cold-start tap: app was killed and launched by tapping the notification.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    });

    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) {
    // Solid green matches the native splash background - no visible transition
    return <View style={{ flex: 1, backgroundColor: theme.colors.primary }} />;
  }

  const shouldShowWelcomePrompt =
    !loading && !welcomeCompleted && !splashVisible;

  const handleWelcomeContinue = async (firstName: string) => {
    try {
      await setFirstName(firstName);
    } catch {
      // Keep the app responsive even if local storage write fails.
    }

    try {
      await markWelcomeCompleted();
    } catch {
      // Keep the app responsive even if local storage write fails.
    }
  };

  const handleWelcomeSkip = async () => {
    try {
      await setFirstName(null);
    } catch {
      // Keep the app responsive even if local storage write fails.
    }

    try {
      await markWelcomeCompleted();
    } catch {
      // Keep the app responsive even if local storage write fails.
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recycling-centre" />
        <Stack.Screen name="broomfields-leisure-centre" />
        <Stack.Screen name="change-name" />
      </Stack>
      <WelcomeNamePrompt
        visible={shouldShowWelcomePrompt}
        onContinue={handleWelcomeContinue}
        onSkip={handleWelcomeSkip}
      />
      {showSplash && (
        <AppSplashScreen
          visible={splashVisible}
          onHidden={() => setShowSplash(false)}
        />
      )}
    </>
  );
}
