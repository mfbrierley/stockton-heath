import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import {
  formatHour,
  useRecyclingCentreHours,
  useWoolstonRecyclingCentreHours,
} from "../hooks/useRecyclingCentreHours";
import Button from "./Button";

export default function RecyclingCentreSection() {
  const { todayHours, tomorrowHours, statusConfig, isPostClose } =
    useRecyclingCentreHours();
  const { label, color, bg, icon } = statusConfig;
  const {
    todayHours: woolstonTodayHours,
    tomorrowHours: woolstonTomorrowHours,
    statusConfig: woolstonStatusConfig,
    isPostClose: isWoolstonPostClose,
  } = useWoolstonRecyclingCentreHours();

  const tipTitleStyle = [
    globalStyles.body,
    globalStyles.bodyBold,
    { fontSize: 18 },
  ];

  return (
    <View style={{ gap: 16 }}>
      <Text style={[globalStyles.heading]}>Recycling Centres</Text>
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
            marginBottom: 16,
          }}
        >
          <Text style={[tipTitleStyle, { color: theme.colors.white }]}>
            Sandy Lane Tip
          </Text>
        </View>
        <View style={{ alignSelf: "flex-start" }}>
          <View
            style={{
              backgroundColor: bg,
              ...globalStyles.statusBadge,
            }}
          >
            <Ionicons name={icon as any} size={14} color={color} />
            <Text
              style={[
                globalStyles.body,
                globalStyles.statusBadgeText,
                { color },
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

      {/* Woolston Tip – secondary card */}
      <View
        style={[
          globalStyles.card,
          {
            backgroundColor: theme.colors.neutral300,
            padding: 32,
            overflow: "hidden",
            position: "relative",
          },
        ]}
      >
        <FontAwesome
          name="recycle"
          size={124}
          color={theme.colors.black}
          style={{
            position: "absolute",
            top: -16,
            right: -16,
            opacity: 0.05,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Text style={tipTitleStyle}>Woolston Tip</Text>
        </View>
        <View style={{ alignSelf: "flex-start" }}>
          <View
            style={{
              backgroundColor: woolstonStatusConfig.bg,
              ...globalStyles.statusBadge,
            }}
          >
            <Ionicons
              name={woolstonStatusConfig.icon as any}
              size={14}
              color={woolstonStatusConfig.color}
            />
            <Text
              style={[
                globalStyles.body,
                globalStyles.statusBadgeText,
                { color: woolstonStatusConfig.color },
              ]}
            >
              {woolstonStatusConfig.label}
            </Text>
          </View>
        </View>
        <View
          style={{
            paddingVertical: 16,
            marginVertical: 16,
            borderTopWidth: 1,
            borderTopColor: theme.colors.neutral400,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.neutral400,
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
            <Text style={globalStyles.body}>Today&apos;s hours</Text>
            <Text style={[globalStyles.body, globalStyles.bodyBold]}>
              {woolstonTodayHours
                ? `${formatHour(woolstonTodayHours.open)} – ${formatHour(woolstonTodayHours.close)}`
                : "Closed"}
            </Text>
          </View>
          {isWoolstonPostClose && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={globalStyles.body}>Tomorrow&apos;s hours</Text>
              <Text style={[globalStyles.body, globalStyles.bodyBold]}>
                {woolstonTomorrowHours
                  ? `${formatHour(woolstonTomorrowHours.open)} – ${formatHour(woolstonTomorrowHours.close)}`
                  : "Closed"}
              </Text>
            </View>
          )}
        </View>
        <Button
          variant="primary"
          width="full"
          onPress={() => router.push("/woolston-recycling-centre")}
        >
          Find out more
        </Button>
      </View>
    </View>
  );
}
