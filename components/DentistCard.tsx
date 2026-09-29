import { Ionicons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import { DentistStatus, NhsDentist } from "../app/types/nhsDentists";

const STATUS: Record<
  DentistStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  accepting: {
    label: "Taking new NHS patients",
    color: theme.colors.statusGreen,
    bg: "#DCFCE7",
    icon: "checkmark-circle",
  },
  not_accepting: {
    label: "Not taking new NHS patients",
    color: theme.colors.neutral900,
    bg: theme.colors.neutral200,
    icon: "close-circle",
  },
  not_confirmed: {
    label: "Not confirmed",
    color: theme.colors.statusAmber,
    bg: "#FEF3C7",
    icon: "help-circle",
  },
  referral_only: {
    label: "Specialist referrals only",
    color: theme.colors.neutral900,
    bg: theme.colors.neutral200,
    icon: "arrow-forward-circle",
  },
};

// nhs.uk's own wording for each group, so the app says no more than it does.
export const GROUPS: { key: keyof NhsDentist["accepting"]; label: string }[] = [
  { key: "adults", label: "adults 18 or over" },
  { key: "children", label: "children aged 17 or under" },
  { key: "freeCare", label: "adults entitled to free dental care" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Practices must re-confirm their status with the NHS every quarter, so a date
// older than that means this one has missed at least one.
const STALE_AFTER_DAYS = 90;

// How long a practice that has started taking a group counts as new.
const NEW_FOR_DAYS = 14;

const describe = (dentist: NhsDentist): string => {
  switch (dentist.status) {
    case "accepting":
      return "For routine care, taking new NHS patients who are:";
    case "not_accepting":
      return dentist.urgentCare
        ? "Not taking new NHS patients for routine care. Phone them if you need urgent dental care."
        : "Not taking new NHS patients for routine care.";
    case "not_confirmed":
      return "Has not told the NHS whether it is taking new NHS patients. Phone to ask.";
    case "referral_only":
      return "Only takes new NHS patients for specialist care, when referred by a dentist.";
  }
};

/** YYYY-MM-DD as a local date, so the day cannot shift with the time zone. */
const parseDay = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

function LastConfirmed({ date }: { date: string }) {
  const day = parseDay(date);
  const ageDays = (Date.now() - day.getTime()) / DAY_MS;
  const stale = ageDays > STALE_AFTER_DAYS;
  const formatted = day.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Text
      style={[
        globalStyles.bodySmall,
        stale
          ? { color: theme.colors.statusAmber, fontFamily: theme.fonts.bodyBold }
          : globalStyles.bodyMuted,
      ]}
    >
      Last confirmed by the practice: {formatted}
      {stale ? " - may be out of date" : ""}
    </Text>
  );
}

const formatDay = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const listOf = (items: string[]) =>
  items.length === 1
    ? items[0]
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * "Newly taking adults 18 or over - spotted 26 Sep", or "Newly taking these
 * patients" when every group it takes is new. The backend checks once
 * a day, so the date is when it was noticed, not necessarily when it happened.
 */
function Opened({ dentist }: { dentist: NhsDentist }) {
  const opened = dentist.opened;
  if (!opened) return null;

  const at = new Date(opened.at);
  if (Date.now() - at.getTime() > NEW_FOR_DAYS * DAY_MS) return null;

  // Only the groups it is still taking - a list can open and close again.
  const taking = GROUPS.filter(({ key }) => dentist.accepting[key]);
  const labels = taking
    .filter(({ key }) => opened.groups.includes(key))
    .map(({ label }) => label);
  if (labels.length === 0) return null;

  // When every group listed above is new, naming them all again says nothing.
  const which = labels.length === taking.length ? "these patients" : listOf(labels);

  return (
    <View style={[styles.groupRow, { alignItems: "flex-start" }]}>
      <Ionicons
        name="sparkles"
        size={14}
        color={theme.colors.statusGreen}
        style={{ marginTop: 4 }}
      />
      <Text
        style={[
          globalStyles.bodySmall,
          globalStyles.bodyBold,
          { color: theme.colors.statusGreen, flex: 1 },
        ]}
      >
        Newly taking {which} - spotted {formatDay(at)}
      </Text>
    </View>
  );
}

/** The coloured pill saying whether a practice is taking new NHS patients. */
export function StatusBadge({ status }: { status: DentistStatus }) {
  const { label, color, bg, icon } = STATUS[status];
  return (
    <View style={{ alignSelf: "flex-start" }}>
      <View style={[globalStyles.statusBadge, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={14} color={color} />
        <Text style={[globalStyles.body, globalStyles.statusBadgeText, { color }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export default function DentistCard({ dentist }: { dentist: NhsDentist }) {
  const groups = GROUPS.filter(({ key }) => dentist.accepting[key]);

  return (
    <View
      style={[globalStyles.card, globalStyles.cardWhite, globalStyles.cardList]}
    >
      <View style={styles.body}>
        <Text style={globalStyles.cardTitle}>{dentist.name}</Text>
        <Text style={[globalStyles.bodySmall, globalStyles.bodyMuted]}>
          {dentist.address}
        </Text>

        <View style={{ marginTop: 4 }}>
          <StatusBadge status={dentist.status} />
        </View>

        <View style={{ gap: 2 }}>
          <Text style={globalStyles.bodySmall}>{describe(dentist)}</Text>
          {groups.map(({ key, label: group }) => (
            <View key={key} style={styles.groupRow}>
              <Feather name="check" size={14} color={theme.colors.statusGreen} />
              <Text style={[globalStyles.bodySmall, globalStyles.bodyBold]}>
                {group}
              </Text>
            </View>
          ))}
        </View>

        <Opened dentist={dentist} />

        {dentist.lastConfirmed && <LastConfirmed date={dentist.lastConfirmed} />}
      </View>

      <View style={globalStyles.divider} />
      <View style={{ paddingHorizontal: 24, paddingVertical: 4 }}>
        {dentist.phone && (
          <>
            <Pressable
              onPress={() =>
                void Linking.openURL(
                  `tel:${dentist.phone!.replace(/\s/g, "")}`,
                ).catch(() => {})
              }
              style={styles.action}
              accessibilityRole="link"
              accessibilityLabel={`Call ${dentist.name} on ${dentist.phone}`}
            >
              <Feather name="phone" size={16} color={theme.colors.green800} />
              <Text style={[globalStyles.body, globalStyles.bodyLink]}>
                {dentist.phone}
              </Text>
            </Pressable>
            <View style={globalStyles.divider} />
          </>
        )}
        <Pressable
          onPress={() => void Linking.openURL(dentist.nhsUrl).catch(() => {})}
          style={styles.action}
          accessibilityRole="link"
          accessibilityLabel={`View ${dentist.name} on the NHS website`}
        >
          <Feather name="external-link" size={16} color={theme.colors.green800} />
          <Text style={[globalStyles.body, globalStyles.bodyLink, { flex: 1 }]}>
            View on the NHS website
          </Text>
          <Feather name="chevron-right" size={16} color={theme.colors.neutral600} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 8,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
});
