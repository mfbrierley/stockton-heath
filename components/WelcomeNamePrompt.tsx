import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { globalStyles } from "../app/styles/globalStyles";
import { theme } from "../app/styles/theme";
import { MAX_FIRST_NAME_LENGTH } from "../hooks/useUserName";
import Button from "./Button";

type WelcomeNamePromptProps = {
  visible: boolean;
  onContinue: (name: string) => Promise<void>;
  onSkip: () => Promise<void>;
};

export function WelcomeNamePrompt({
  visible,
  onContinue,
  onSkip,
}: WelcomeNamePromptProps) {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setFirstName("");
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  const handleContinue = async () => {
    const trimmed = firstName.trim();
    if (trimmed.length > MAX_FIRST_NAME_LENGTH) {
      setError(
        `Name must be fewer than ${MAX_FIRST_NAME_LENGTH + 1} characters.`,
      );
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onContinue(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSkip();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Image
        source={require("../assets/images/bridgewater-canal.png")}
        style={[styles.hero, { paddingTop: insets.top }]}
        contentFit="cover"
      />

      <View style={styles.sheetWrap}>
        <View style={styles.sheetContent}>
          <View style={styles.headerBlock}>
            <Text
              style={[
                globalStyles.heading,
                globalStyles.headingBold,
                styles.title,
              ]}
            >
              Welcome to Stockton Heath
            </Text>
            <Text style={[globalStyles.body, styles.subtitle]}>
              Let&apos;s personalise your experience by getting to know you.
            </Text>
          </View>

          <View style={styles.formBlock}>
            <Text
              style={[
                globalStyles.body,
                globalStyles.bodyBold,
                styles.question,
              ]}
            >
              What&apos;s your first name?
            </Text>
            <View style={styles.inputWrap}>
              <Feather
                name="user"
                size={22}
                color={theme.colors.neutral600}
                style={styles.inputIcon}
              />
              <TextInput
                value={firstName}
                onChangeText={(value) => {
                  setFirstName(value);
                  if (error) setError(null);
                }}
                placeholder="Enter your first name"
                placeholderTextColor={theme.colors.neutral600}
                maxLength={MAX_FIRST_NAME_LENGTH + 2}
                autoCapitalize="words"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
            {error && (
              <Text style={[globalStyles.body, styles.errorText]}>{error}</Text>
            )}

            <View style={styles.buttonGroup}>
              <Button
                variant="primary"
                width="full"
                loading={submitting}
                onPress={() => void handleContinue()}
              >
                Continue
              </Button>
              <Button
                variant="ghost"
                width="full"
                disabled={submitting}
                onPress={() => void handleSkip()}
              >
                I&apos;d prefer not to say
              </Button>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutral100,
  },
  hero: {
    flex: 1,
    width: "100%",
    minHeight: 280,
  },
  sheetWrap: {
    flex: 1.15,
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.neutral100,
    overflow: "hidden",
  },
  sheetContent: {
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 28,
  },
  headerBlock: {
    alignItems: "center",
    gap: 12,
  },
  title: {
    textAlign: "center",
    fontSize: 31,
    lineHeight: 42,
  },
  subtitle: {
    textAlign: "center",
    color: theme.colors.neutral800,
    fontSize: 18,
    lineHeight: 27,
    maxWidth: 330,
  },
  formBlock: {
    gap: 18,
  },
  question: {
    color: theme.colors.green1000,
    fontSize: 19,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.neutral300,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.body,
    color: theme.colors.neutral1000,
  },
  errorText: {
    color: theme.colors.statusRed,
    marginTop: -2,
  },
  buttonGroup: {
    gap: 18,
    marginTop: 4,
  },
});
