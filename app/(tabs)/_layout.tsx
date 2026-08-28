import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { DISCOUNTS_VISIBLE } from "../../utils/discountsVisible";
import { globalStyles } from "../styles/globalStyles";
import { theme } from "../styles/theme";

const customHeader = () => {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text
        allowFontScaling={false}
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

export default function TabsLayout() {
  return (
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
          headerTitle: customHeader,
          // Hidden on the production channel until this is signed off. `null`
          // takes it out of the tab bar but leaves the route registered, so a
          // deep link to stocktonheath://discounts still reaches it - which is
          // how to look at it inside a real App Store build.
          href: DISCOUNTS_VISIBLE ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Feather name="tag" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="bridge"
        options={{
          title: "Bridge",
          headerTitle: customHeader,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bridge" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
