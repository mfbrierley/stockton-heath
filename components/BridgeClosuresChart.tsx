import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polyline,
  Stop,
  Svg,
  Text as SvgText,
} from "react-native-svg";
import { theme } from "../app/styles/theme";

type BridgeAlert = {
  id: number;
  tweetId: string;
  tweetText: string;
  postedAt: string;
  detectedAt: string;
};

type DayData = {
  label: string;
  count: number;
  date: Date;
};

const parseTwitterDate = (dateStr: string): Date => {
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const parts = dateStr.split(" ");
  const month = months[parts[1]] ?? "01";
  const day = (parts[2] ?? "1").padStart(2, "0");
  const time = parts[3] ?? "00:00:00";
  const year = parts[5] ?? "2000";
  return new Date(`${year}-${month}-${day}T${time}Z`);
};

function getLast7Days(): DayData[] {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days: DayData[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({ label: dayNames[d.getDay()] ?? "?", count: 0, date: d });
  }
  return days;
}

function groupAlertsByDay(alerts: BridgeAlert[]): DayData[] {
  const days = getLast7Days();
  alerts.forEach((alert) => {
    const alertDate = parseTwitterDate(alert.postedAt);
    alertDate.setHours(0, 0, 0, 0);
    const dayEntry = days.find((d) => d.date.getTime() === alertDate.getTime());
    if (dayEntry) dayEntry.count++;
  });
  return days;
}

const CHART_HEIGHT = 160;
const PAD = { top: 16, right: 12, bottom: 28, left: 28 };

export default function BridgeClosuresChart() {
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  // screen padding 16 + card padding 16 = 32 per side
  const chartWidth = screenWidth - 64;

  useEffect(() => {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      setError(true);
      setLoading(false);
      return;
    }
    fetch(`${backendUrl}/bridge-alerts`)
      .then((res) => res.json())
      .then((data: unknown) => {
        const alerts = Array.isArray(data) ? (data as BridgeAlert[]) : [];
        setDays(groupAlertsByDay(alerts));
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const totalClosures = days.reduce((sum, d) => sum + d.count, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return <Text style={styles.errorText}>Unable to load closure data</Text>;
  }

  const innerW = chartWidth - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const maxCount = Math.max(...days.map((d) => d.count), 1);
  const yMax = maxCount + 1;
  const step = innerW / 7;

  const getX = (i: number) => PAD.left + i * step + step / 2;
  const getY = (count: number) => PAD.top + innerH - (count / yMax) * innerH;

  const linePoints = days
    .map((d, i) => `${getX(i)},${getY(d.count)}`)
    .join(" ");

  // Closed path for the gradient fill: line points + close down to baseline
  const baselineY = PAD.top + innerH;
  const firstX = getX(0);
  const lastX = getX(days.length - 1);
  const areaPath =
    `M ${firstX},${baselineY} ` +
    days.map((d, i) => `L ${getX(i)},${getY(d.count)}`).join(" ") +
    ` L ${lastX},${baselineY} Z`;

  const gridValues = [0, Math.round(yMax / 2), yMax];

  return (
    <View style={styles.container}>
      <Text style={styles.totalLabel}>
        {totalClosures} closure{totalClosures !== 1 ? "s" : ""} in the last 7
        days
      </Text>

      <View style={styles.chartWrapper} pointerEvents="none">
        {chartWidth > 0 && (
          <Svg width={chartWidth} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={theme.colors.primary}
                  stopOpacity="0.35"
                />
                <Stop
                  offset="1"
                  stopColor={theme.colors.primary}
                  stopOpacity="0"
                />
              </LinearGradient>
            </Defs>

            {/* Grid lines + Y-axis labels */}
            {gridValues.map((val) => {
              const y = getY(val);
              return (
                <G key={val}>
                  <Line
                    x1={PAD.left}
                    y1={y}
                    x2={chartWidth - PAD.right}
                    y2={y}
                    stroke={theme.colors.neutral300}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  <SvgText
                    x={PAD.left - 6}
                    y={y + 4}
                    fontSize={9}
                    textAnchor="end"
                    fill={theme.colors.neutral700}
                  >
                    {val}
                  </SvgText>
                </G>
              );
            })}

            {/* Gradient fill area */}
            <Path d={areaPath} fill="url(#areaGrad)" />

            {/* Line */}
            <Polyline
              points={linePoints}
              fill="none"
              stroke={theme.colors.primary}
              strokeWidth={2}
            />

            {/* Dots */}
            {days.map((d, i) => (
              <Circle
                key={i}
                cx={getX(i)}
                cy={getY(d.count)}
                r={3.5}
                fill={theme.colors.primary}
                stroke={theme.colors.neutral100}
                strokeWidth={1.5}
              />
            ))}

            {/* X-axis labels */}
            {days.map((d, i) => (
              <SvgText
                key={i}
                x={getX(i)}
                y={CHART_HEIGHT - 4}
                fontSize={10}
                textAnchor="middle"
                fill={theme.colors.neutral700}
              >
                {d.label}
              </SvgText>
            ))}
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 8,
  },
  loadingContainer: {
    height: CHART_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.neutral700,
    textAlign: "center",
    padding: 16,
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.neutral700,
  },
  chartWrapper: {
    width: "100%",
  },
});
