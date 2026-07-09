import Feather from "@expo/vector-icons/Feather";
import { Linking, ScrollView, Text, View } from "react-native";
import BackHeader from "../components/BackHeader";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";

const FAQS: { question: string; answer: string }[] = [
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
      "The app checks for new bridge closure announcements from the council every 10 minutes, between 6am and 10pm UK time. The timing is not completely accurate, as the council doesn't provide exact times for bridge closures. They only publish an estimated time, which is what the app uses to determine if the bridge is closed or open. People find it to be close enough to be useful.",
  },
  {
    question: "Why is my address not showing up in the bin lookup?",
    answer:
      "The address list comes directly from Warrington Borough Council's database. If your address is missing, it may not yet be registered with the council. Try searching for nearby addresses.",
  },
];

const TROUBLESHOOTING: { issue: string; fix: string }[] = [
  {
    issue: "I'm not receiving notifications",
    fix: "Make sure you've allowed notifications for the app in your iPhone's Settings. Go to Settings → Notifications → Stockton Heath and ensure 'Allow Notifications' is on. For bridge alerts, re-subscribe in the Bridge tab. For bin reminders, re-enable them on the Services tab after looking up your address.",
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
  isLast,
}: {
  question: string;
  answer: string;
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
              Get in touch - I&apos;d love to hear from you.
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
