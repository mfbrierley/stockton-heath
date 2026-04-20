import {
  NotoSerif_400Regular,
  NotoSerif_700Bold,
} from "@expo-google-fonts/noto-serif";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, Text, View } from "react-native";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const registerForPushNotifications = async (): Promise<void> => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backendUrl) return;

  await fetch(`${backendUrl}/push-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
};

const customHeader = () => {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text
        style={[
          globalStyles.heading,
          globalStyles.headingBold,
          { color: theme.colors.green800, fontSize: 20, lineHeight: 30 },
        ]}
      >
        StocktonHeath
      </Text>
    </View>
  );
};

export default function RootLayout() {
  useEffect(() => {
    void registerForPushNotifications();
  }, []);

  const [fontsLoaded] = useFonts({
    NotoSerif: NotoSerif_400Regular,
    NotoSerifBold: NotoSerif_700Bold,
    PlusJakartaSans: PlusJakartaSans_400Regular,
    PlusJakartaSansBold: PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text>Loading fonts...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.neutral100,
            borderBottomWidth: 0,
            shadowOpacity: 0,
            elevation: 0,
            height: 100,
          },
          headerTintColor: theme.colors.neutral200,
          headerTitleStyle: {
            fontFamily: theme.fonts.heading,
          },
          headerTitleContainerStyle: {
            paddingTop: 0,
            paddingBottom: 8,
          },
          tabBarActiveTintColor: theme.colors.tertiary,
          tabBarStyle: {
            paddingTop: 4,
            backgroundColor: theme.colors.white,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Feather name="home" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="services"
          options={{
            title: "Services",
            headerTitle: customHeader,
            tabBarIcon: ({ color, size }) => (
              <Feather name="trash-2" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="discounts"
          options={{
            title: "Discounts",
            tabBarIcon: ({ color, size }) => (
              <Feather name="tag" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="bridge"
          options={{
            title: "Bridge",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="bridge" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
