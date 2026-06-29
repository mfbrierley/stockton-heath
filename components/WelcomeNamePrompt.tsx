import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  const [renderPrompt, setRenderPrompt] = useState(visible);
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setRenderPrompt(true);
      fadeAnim.setValue(1);
      setFirstName("");
      setError(null);
      setSubmitting(false);
      return;
    }

    if (!renderPrompt) {
      return;
    }

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => setRenderPrompt(false));
  }, [visible, renderPrompt, fadeAnim]);

  if (!renderPrompt) {
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
    <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
      <Image
        source={require("../assets/images/bridgewater-canal.png")}
        style={[styles.hero, { paddingTop: insets.top }]}
        contentFit="cover"
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <View style={styles.sheetWrap}>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={[
              styles.sheetContent,
              { paddingBottom: insets.bottom + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerBlock}>
              <Text
                style={[
                  globalStyles.heading,
                  globalStyles.headingBold,
                  styles.title,
                ]}
              >
                Welcome to{"\n"}Stockton Heath
              </Text>
            </View>

            <View style={styles.formBlock}>
              <View style={styles.formFields}>
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
                  <Text style={[globalStyles.body, styles.errorText]}>
                    {error}
                  </Text>
                )}
              </View>

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
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.neutral100,
  },
  hero: {
    flex: 0.68,
    width: "100%",
    minHeight: 180,
  },
  keyboardAvoiding: {
    flex: 1.5,
  },
  sheetWrap: {
    flex: 1,
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.neutral100,
    overflow: "hidden",
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 26,
  },
  headerBlock: {
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
  },
  title: {
    textAlign: "center",
    fontSize: 30,
    lineHeight: 40,
  },
  formBlock: {
    flex: 1,
  },
  formFields: {
    gap: 18,
  },
  question: {
    color: theme.colors.green1000,
    fontSize: 19,
    textAlign: "center",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.neutral300,
    paddingHorizontal: 16,
    minHeight: 56,
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
    gap: 16,
    marginTop: "auto",
    paddingTop: 20,
  },
});
