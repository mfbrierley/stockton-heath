import Feather from "@expo/vector-icons/Feather";
import { Linking, Platform, ScrollView, Text, View } from "react-native";
import BackHeader from "../components/BackHeader";
import SourceNote from "../components/SourceNote";
import { TRAFFICWARR_URL, WARRINGTON_BINS_URL } from "../utils/dataSources";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";

const FAQS: {
  question: string;
  answer: string;
  link?: { label: string; url: string };
}[] = [
  {
    question: "Is this an official Warrington Borough Council app?",
    answer:
      "No. This is an unofficial app built by a local resident. It isn't affiliated with, endorsed by, or connected to Warrington Borough Council, the UK Government, or any other public body. It only reads information those bodies already publish - it can't change anything they hold, and it isn't a way to contact them. For anything official, go to the council directly.",
    link: {
      label: "Warrington Borough Council:",
      url: "https://www.warrington.gov.uk",
    },
  },
  {
    question: "How do I look up my bin collection day?",
    answer:
      "Go to the Services tab and tap 'Find my bin collections'. Enter your postcode, then select your address from the list. Your upcoming collections will be shown and remembered for next time.",
  },
  {
    question: "How do I get bridge closure alerts?",
    answer:
      "Go to the Bridge tab and tap 'Get notified'. You'll be asked to allow notifications - once enabled, you'll receive a push notification whenever a new swing bridge closure is detected.",
  },
  {
    question: "Can I get a reminder before my bin collection?",
    answer:
      "Yes - on the Services tab, after looking up your address, you can enable bin collection reminders. You'll get a notification the evening before each collection so you don't forget to put your bins out.",
  },
  {
    question: "How current are the fuel prices?",
    answer:
      "Fuel prices are fetched from the UK Government's Fuel Finder data source and refreshed every 30 minutes.",
  },
  {
    question: "How current is the bridge alert?",
    answer:
      "Bridge alerts come from Traffic Warrington (@trafficwarr), a third-party account on X that the app monitors. The app checks it for new swing bridge posts every 10 minutes, between 6am and 10pm UK time. The timing is not exact: the posts give an estimated closing time, which is what the app uses to judge whether the bridge is closed or open. People find it close enough to be useful.",
    link: {
      label: "Bridge alerts are read from:",
      url: TRAFFICWARR_URL,
    },
  },
  {
    question: "Why is my address not showing up in the bin lookup?",
    answer:
      "The address list comes directly from Warrington Borough Council's database. If your address is missing, it may not yet be registered with the council. Try searching for nearby addresses.",
    link: {
      label: "Bin collections at the council:",
      url: WARRINGTON_BINS_URL,
    },
  },
];

/** Where to turn notifications back on - the two platforms bury it differently. */
const NOTIFICATION_SETTINGS_PATH = Platform.select({
  ios: "Make sure you've allowed notifications for the app in your iPhone's Settings. Go to Settings → Notifications → Stockton Heath and turn 'Allow Notifications' on.",
  android:
    "Make sure you've allowed notifications for the app in your phone's Settings. Go to Settings → Apps → Stockton Heath → Notifications and turn them on.",
  default:
    "Make sure you've allowed notifications for the app in your device's Settings.",
});

const TROUBLESHOOTING: { issue: string; fix: string }[] = [
  {
    issue: "I'm not receiving notifications",
    fix: `${NOTIFICATION_SETTINGS_PATH} For bridge alerts, re-subscribe in the Bridge tab. For bin reminders, re-enable them on the Services tab after looking up your address.`,
  },
  {
    issue: "The weather isn't loading",
    fix: "Check your internet connection. If the problem persists, close and reopen the app. Weather data requires an active connection and can't be shown offline.",
  },
  {
    issue: "The bin lookup isn't finding my address",
    fix: "Double-check your postcode is correct. If you're in a newly built property, your address may not yet be on the council's system.",
  },
];

function FAQItem({
  question,
  answer,
  link,
  isLast,
}: {
  question: string;
  answer: string;
  link?: { label: string; url: string };
  isLast: boolean;
}) {
  return (
    <View>
      <View style={{ paddingVertical: 14 }}>
        <Text style={[globalStyles.body, globalStyles.bodyBold]}>
          {question}
        </Text>
        <Text
          style={[globalStyles.body, globalStyles.bodyMuted, { marginTop: 4 }]}
        >
          {answer}
        </Text>
        {link && (
          <View style={{ marginTop: 6 }}>
            <SourceNote label={link.label} url={link.url} />
          </View>
        )}
      </View>
      {!isLast && <View style={globalStyles.divider} />}
    </View>
  );
}

function TroubleshootItem({
  issue,
  fix,
  isLast,
}: {
  issue: string;
  fix: string;
  isLast: boolean;
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          paddingVertical: 14,
        }}
      >
        <Feather
          name="tool"
          size={16}
          color={theme.colors.green700}
          style={{ marginTop: 3 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={[globalStyles.body, globalStyles.bodyBold]}>
            {issue}
          </Text>
          <Text
            style={[
              globalStyles.body,
              globalStyles.bodyMuted,
              { marginTop: 4 },
            ]}
          >
            {fix}
          </Text>
        </View>
      </View>
      {!isLast && <View style={globalStyles.divider} />}
    </View>
  );
}

export default function Help() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.neutral200 }}>
      <BackHeader />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: 40,
        }}
      >
        <View>
          <Text style={[globalStyles.heading, globalStyles.headingBold]}>
            Help
          </Text>
          <Text
            style={[
              globalStyles.body,
              globalStyles.bodyMuted,
              { marginTop: 6 },
            ]}
          >
            Answers to common questions and fixes for known issues.
          </Text>
        </View>

        {/* Contact */}
        <View
          style={[
            globalStyles.card,
            globalStyles.cardWhite,
            globalStyles.cardList,
          ]}
        >
          <View style={globalStyles.cardListHeader}>
            <Text
              style={[
                globalStyles.body,
                globalStyles.bodyBold,
                globalStyles.cardListHeaderText,
              ]}
            >
              Get in Touch
            </Text>
          </View>
          <View style={{ paddingHorizontal: 24, paddingVertical: 16, gap: 4 }}>
            <Text style={[globalStyles.body, globalStyles.bodyMuted]}>
              Have a question, spotted a bug, or want to suggest a new feature?
              Get in touch.
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginTop: 8,
              }}
            >
              <Feather name="mail" size={16} color={theme.colors.green700} />
              <Text
                style={[
                  globalStyles.body,
                  globalStyles.bodyBold,
                  globalStyles.bodyLink,
                ]}
                onPress={() =>
                  void Linking.openURL(
                    "mailto:stocktonheathapp@gmail.com",
                  ).catch(() => {})
                }
              >
                stocktonheathapp@gmail.com
              </Text>
            </View>
          </View>
        </View>

        {/* FAQ */}
        <View
          style={[
            globalStyles.card,
            globalStyles.cardWhite,
            globalStyles.cardList,
          ]}
        >
          <View style={globalStyles.cardListHeader}>
            <Text
              style={[
                globalStyles.body,
                globalStyles.bodyBold,
                globalStyles.cardListHeaderText,
              ]}
            >
              Frequently Asked Questions
            </Text>
          </View>
          <View style={{ paddingHorizontal: 24 }}>
            {FAQS.map((item, i) => (
              <FAQItem
                key={item.question}
                question={item.question}
                answer={item.answer}
                link={item.link}
                isLast={i === FAQS.length - 1}
              />
            ))}
          </View>
        </View>

        {/* Troubleshooting */}
        <View
          style={[
            globalStyles.card,
            globalStyles.cardWhite,
            globalStyles.cardList,
          ]}
        >
          <View style={globalStyles.cardListHeader}>
            <Text
              style={[
                globalStyles.body,
                globalStyles.bodyBold,
                globalStyles.cardListHeaderText,
              ]}
            >
              Troubleshooting
            </Text>
          </View>
          <View style={{ paddingHorizontal: 24 }}>
            {TROUBLESHOOTING.map((item, i) => (
              <TroubleshootItem
                key={item.issue}
                issue={item.issue}
                fix={item.fix}
                isLast={i === TROUBLESHOOTING.length - 1}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
