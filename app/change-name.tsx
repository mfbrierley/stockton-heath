import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BackHeader from "../components/BackHeader";
import { MAX_FIRST_NAME_LENGTH, useUserName } from "../hooks/useUserName";
import { globalStyles } from "./styles/globalStyles";
import { theme } from "./styles/theme";

const AUTO_SAVE_DELAY_MS = 500;

export default function ChangeName() {
  const { firstName, setFirstName } = useUserName();
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const hydrated = useRef(false);

  useEffect(() => {
    setNameInput(firstName ?? "");
    hydrated.current = true;
    setError(null);
    setStatus("idle");
  }, [firstName]);

  useEffect(() => {
    if (!hydrated.current) {
      return;
    }

    const trimmed = nameInput.trim();
    if (trimmed.length > MAX_FIRST_NAME_LENGTH) {
      setError(
        `Name must be fewer than ${MAX_FIRST_NAME_LENGTH + 1} characters.`,
      );
      setStatus("idle");
      return;
    }

    setError(null);

    const storedName = firstName ?? "";
    if (trimmed === storedName) {
      setStatus("idle");
      return;
    }

    setStatus("saving");
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await setFirstName(trimmed.length ? trimmed : null);
          setStatus("saved");
        } catch {
          setStatus("error");
        }
      })();
    }, AUTO_SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [firstName, nameInput, setFirstName]);

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
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 8 }}>
          <Text style={[globalStyles.heading, globalStyles.headingBold]}>
            Change my name
          </Text>
          <Text style={[globalStyles.body, globalStyles.bodyMuted]}>
            Update how your name appears in the app. Changes are saved
            automatically.
          </Text>
        </View>

        <View
          style={[globalStyles.card, globalStyles.cardWhite, styles.formCard]}
        >
          <Text style={[globalStyles.body, globalStyles.bodyBold]}>
            First name
          </Text>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="Enter your first name"
            placeholderTextColor={theme.colors.neutral600}
            autoCapitalize="words"
            autoCorrect={false}
            style={styles.input}
          />
          <Text style={[globalStyles.body, styles.hint]}>
            Keep it under {MAX_FIRST_NAME_LENGTH + 1} characters.
          </Text>
          {error ? (
            <Text style={[globalStyles.body, styles.errorText]}>{error}</Text>
          ) : null}
          {status === "saving" ? (
            <Text style={[globalStyles.body, styles.statusText]}>
              Saving...
            </Text>
          ) : null}
          {status === "saved" ? (
            <Text style={[globalStyles.body, styles.statusText]}>Saved.</Text>
          ) : null}
          {status === "error" ? (
            <Text style={[globalStyles.body, styles.errorText]}>
              Could not save right now. Please try again.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: {
    padding: 20,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.neutral400,
    borderRadius: 12,
    backgroundColor: theme.colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.body,
    color: theme.colors.neutral1000,
  },
  hint: {
    color: theme.colors.neutral700,
    fontSize: 14,
  },
  statusText: {
    color: theme.colors.green700,
  },
  errorText: {
    color: theme.colors.statusRed,
  },
});
