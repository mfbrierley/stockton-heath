import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import Button from "./Button";

type Status = "open" | "closing-soon" | "opening-soon" | "closed";

// Fixed closure dates in MM-DD format
const FIXED_CLOSURE_DATES = new Set(["12-25", "12-26", "01-01"]);
const SOON_THRESHOLD_MINS = 30;

function getUKTimeParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");

  return {
    month: parseInt(get("month"), 10),
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    isWeekend: weekday === "Saturday" || weekday === "Sunday",
    // YYYY-MM-DD — matches format returned by gov.uk bank holidays API
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    // MM-DD — matches FIXED_CLOSURE_DATES
    mmdd: `${get("month")}-${get("day")}`,
  };
}

function getTodayHours(
  isWeekend: boolean,
  isBankHoliday: boolean,
  isFixedClosed: boolean,
  month: number,
): { open: number; close: number } | null {
  if (isFixedClosed) return null;
  // Spring/summer weekends and bank holidays close at 6pm; all other days 4pm
  const isSpring = month >= 4 && month <= 9;
  if (isSpring && (isWeekend || isBankHoliday)) {
    return { open: 10, close: 18 };
  }
  return { open: 10, close: 16 };
}

function computeStatus(
  hour: number,
  minute: number,
  hours: { open: number; close: number } | null,
): Status {
  if (!hours) return "closed";
  const current = hour * 60 + minute;
  const open = hours.open * 60;
  const close = hours.close * 60;
  if (current >= close) return "closed";
  if (current >= close - SOON_THRESHOLD_MINS) return "closing-soon";
  if (current >= open) return "open";
  if (current >= open - SOON_THRESHOLD_MINS) return "opening-soon";
  return "closed";
}

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h > 12 ? `${h - 12}pm` : `${h}am`;
}

type StatusConfig = { label: string; color: string; bg: string; icon: string };

const STATUS_CONFIG: Record<Status, StatusConfig> = {
  open: {
    label: "Open now",
    color: theme.colors.statusGreen,
    bg: "#DCFCE7",
    icon: "checkmark-circle",
  },
  "closing-soon": {
    label: "Closing soon",
    color: theme.colors.statusAmber,
    bg: "#FEF3C7",
    icon: "time",
  },
  "opening-soon": {
    label: "Opening soon",
    color: theme.colors.statusAmber,
    bg: "#FEF3C7",
    icon: "time",
  },
  closed: {
    label: "Closed",
    color: theme.colors.statusRed,
    bg: "#FEE2E2",
    icon: "close-circle",
  },
};

export default function RecyclingCentreSection() {
  const [bankHolidays, setBankHolidays] = useState<Set<string>>(new Set());
  const [timeParts, setTimeParts] = useState(getUKTimeParts);

  useEffect(() => {
    fetch("https://www.gov.uk/bank-holidays.json")
      .then((r) => r.json())
      .then((data) => {
        const dates = new Set<string>(
          (data["england-and-wales"].events as { date: string }[]).map(
            (e) => e.date,
          ),
        );
        setBankHolidays(dates);
      })
      .catch(() => {
        // Fail silently — status will not account for bank holidays
      });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeParts(getUKTimeParts());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const isBankHoliday = bankHolidays.has(timeParts.dateKey);
  const isFixedClosed = FIXED_CLOSURE_DATES.has(timeParts.mmdd);
  const todayHours = getTodayHours(
    timeParts.isWeekend,
    isBankHoliday,
    isFixedClosed,
    timeParts.month,
  );
  const status = computeStatus(timeParts.hour, timeParts.minute, todayHours);
  const { label, color, bg, icon } = STATUS_CONFIG[status];

  return (
    <View style={[globalStyles.card, globalStyles.cardTertiary]}>
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
        <FontAwesome name="recycle" size={24} color={theme.colors.white} />
      </View>
      <View style={{ alignSelf: "flex-start" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: bg,
            borderWidth: 1,
            borderColor: color,
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
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 16,
          marginVertical: 16,
          borderTopWidth: 1,
          borderTopColor: "rgba(255, 255, 255, 0.3)",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 255, 255, 0.3)",
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
      <Button
        variant="white"
        width="full"
        onPress={() =>
          Linking.openURL(
            "https://www.warrington.gov.uk/household-waste-recycling-centres",
          )
        }
      >
        Find out more
      </Button>
    </View>
  );
}
