import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import {
  formatHour,
  useRecyclingCentreHours,
} from "../hooks/useRecyclingCentreHours";
import Button from "./Button";

export default function RecyclingCentreSection() {
  const { todayHours, tomorrowHours, statusConfig, isPostClose } =
    useRecyclingCentreHours();
  const { label, color, bg, icon } = statusConfig;

  return (
    <View
      style={[
        globalStyles.card,
        globalStyles.cardTertiary,
        {
          overflow: "hidden",
          position: "relative",
        },
      ]}
    >
      <FontAwesome
        name="recycle"
        size={124}
        color={theme.colors.white}
        style={{
          position: "absolute",
          top: -16,
          right: -16,
          opacity: 0.1,
        }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <Text style={[globalStyles.heading, globalStyles.headingWhite]}>
          Sandy Lane Tip
        </Text>
      </View>
      <View style={{ alignSelf: "flex-start" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: bg,
            borderRadius: 20,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
        >
          <Ionicons name={icon as any} size={14} color={color} />
          <Text
            style={[
              globalStyles.body,
              { color, fontFamily: "PlusJakartaSansBold", fontSize: 13 },
            ]}
          >
            {label}
          </Text>
        </View>
      </View>
      <View
        style={{
          paddingVertical: 16,
          marginVertical: 16,
          borderTopWidth: 1,
          borderTopColor: "rgba(255, 255, 255, 0.3)",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 255, 255, 0.3)",
          gap: 8,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={[globalStyles.body, { color: theme.colors.white }]}>
            Today&apos;s hours
          </Text>
          <Text
            style={[
              globalStyles.body,
              globalStyles.bodyBold,
              { color: theme.colors.white },
            ]}
          >
            {todayHours
              ? `${formatHour(todayHours.open)} – ${formatHour(todayHours.close)}`
              : "Closed"}
          </Text>
        </View>
        {isPostClose && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={[globalStyles.body, { color: theme.colors.white }]}>
              Tomorrow&apos;s hours
            </Text>
            <Text
              style={[
                globalStyles.body,
                globalStyles.bodyBold,
                { color: theme.colors.white },
              ]}
            >
              {tomorrowHours
                ? `${formatHour(tomorrowHours.open)} – ${formatHour(tomorrowHours.close)}`
                : "Closed"}
            </Text>
          </View>
        )}
      </View>
      <Button
        variant="white"
        width="full"
        onPress={() => router.push("/recycling-centre")}
      >
        Find out more
      </Button>
    </View>
  );
}
