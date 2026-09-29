import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";

// A launch notice, not a permanent part of Home: it stops showing on its own
// after this date (local time), and anyone can close it sooner. Move the date
// if the launch slips; delete the component once it has passed.
const ANNOUNCEMENT_EXPIRY = new Date("2026-12-01T00:00:00");

const DISMISSED_KEY = "nhsDentistsAnnouncementDismissed";

type NhsDentistsAnnouncementProps = {
  onPress: () => void;
};

/** Tells people on the Home tab that the NHS Dentists screen exists. */
export default function NhsDentistsAnnouncement({
  onPress,
}: NhsDentistsAnnouncementProps) {
  // Hidden until the dismissal has been read, so someone who closed it never
  // sees it flash back up while the app starts.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Date.now() >= ANNOUNCEMENT_EXPIRY.getTime()) return;
    let isMounted = true;
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((dismissed) => {
        if (isMounted && !dismissed) setVisible(true);
      })
      .catch(() => {
        if (isMounted) setVisible(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(DISMISSED_KEY, "true").catch(() => {});
  };

  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Pressable
        onPress={onPress}
        style={styles.body}
        accessibilityRole="link"
        accessibilityLabel="New: see which NHS dentists near Stockton Heath are taking on new patients"
      >
        <MaterialCommunityIcons
          name="tooth-outline"
          size={22}
          color={theme.colors.primary}
          style={{ marginTop: 1 }}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={globalStyles.bodySmall}>
            <Text style={globalStyles.bodyBold}>New: </Text>
            see which NHS dentists near Stockton Heath are taking on new
            patients.
          </Text>
          <View style={styles.linkRow}>
            <Text
              style={[
                globalStyles.bodySmall,
                globalStyles.bodyBold,
                globalStyles.bodyLink,
              ]}
            >
              Take a look
            </Text>
            <Feather
              name="arrow-right"
              size={14}
              color={theme.colors.green800}
            />
          </View>
        </View>
      </Pressable>
      <Pressable
        onPress={dismiss}
        hitSlop={12}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Feather name="x" size={18} color={theme.colors.neutral700} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.green100,
    borderWidth: 1,
    borderColor: theme.colors.green200,
    borderRadius: 16,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 8,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  close: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
