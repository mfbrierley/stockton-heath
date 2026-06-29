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
import { useEffect, useState } from "react";
import { View } from "react-native";
import { AppSplashScreen } from "../components/AppSplashScreen";
import { WelcomeNamePrompt } from "../components/WelcomeNamePrompt";
import { UserNameProvider, useUserName } from "../hooks/useUserName";
import { theme } from "./styles/theme";

export const ACTIVE_CLOSURE_KEY = "activeBridgeClosure";

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

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          tweetId?: string;
          firstBridge?: string | null;
          closureMinutes?: number | null;
          sentAt?: number;
        };

        if (data?.tweetId) {
          const closureMinutes =
            typeof data.closureMinutes === "number" ? data.closureMinutes : 45;
          const notificationSentAt =
            typeof data.sentAt === "number" ? data.sentAt : Date.now();
          const expiresAt =
            notificationSentAt + (closureMinutes + 15) * 60 * 1000;

          // If the closure window has already passed, don't show the banner
          if (Date.now() > expiresAt) {
            router.push("/(tabs)/bridge");
            return;
          }

          void AsyncStorage.setItem(
            ACTIVE_CLOSURE_KEY,
            JSON.stringify({
              firstBridge: data.firstBridge ?? null,
              expiresAt,
            }),
          );

          router.push("/(tabs)/bridge");
        }
      },
    );

    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) {
    // Solid green matches the native splash background — no visible transition
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
      {shouldShowWelcomePrompt ? (
        <WelcomeNamePrompt
          visible={shouldShowWelcomePrompt}
          onContinue={handleWelcomeContinue}
          onSkip={handleWelcomeSkip}
        />
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="recycling-centre" />
          <Stack.Screen name="broomfields-leisure-centre" />
          <Stack.Screen name="change-name" />
        </Stack>
      )}
      {showSplash && (
        <AppSplashScreen
          visible={splashVisible}
          onHidden={() => setShowSplash(false)}
        />
      )}
    </>
  );
}
