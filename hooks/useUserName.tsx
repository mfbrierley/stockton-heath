import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const USER_FIRST_NAME_KEY = "userFirstName";
export const WELCOME_COMPLETED_KEY = "welcomeCompleted";
export const MAX_FIRST_NAME_LENGTH = 11;

type UserNameContextValue = {
  firstName: string | null;
  welcomeCompleted: boolean;
  loading: boolean;
  setFirstName: (value: string | null) => Promise<void>;
  markWelcomeCompleted: () => Promise<void>;
};

const UserNameContext = createContext<UserNameContextValue | undefined>(
  undefined,
);

const sanitizeFirstName = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_FIRST_NAME_LENGTH);
};

export function UserNameProvider({ children }: { children: React.ReactNode }) {
  const [firstName, setFirstNameState] = useState<string | null>(null);
  const [welcomeCompleted, setWelcomeCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          USER_FIRST_NAME_KEY,
          WELCOME_COMPLETED_KEY,
        ]);
        if (!isMounted) return;

        const storedFirstName = entries[0]?.[1] ?? null;
        const storedWelcomeCompleted = entries[1]?.[1] ?? null;

        setFirstNameState(sanitizeFirstName(storedFirstName));
        setWelcomeCompleted(storedWelcomeCompleted === "true");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const setFirstName = useCallback(async (value: string | null) => {
    const nextValue = sanitizeFirstName(value);
    setFirstNameState(nextValue);

    if (nextValue) {
      await AsyncStorage.setItem(USER_FIRST_NAME_KEY, nextValue);
      return;
    }

    await AsyncStorage.removeItem(USER_FIRST_NAME_KEY);
  }, []);

  const markWelcomeCompleted = useCallback(async () => {
    setWelcomeCompleted(true);
    await AsyncStorage.setItem(WELCOME_COMPLETED_KEY, "true");
  }, []);

  const value = useMemo(
    () => ({
      firstName,
      welcomeCompleted,
      loading,
      setFirstName,
      markWelcomeCompleted,
    }),
    [firstName, loading, markWelcomeCompleted, setFirstName, welcomeCompleted],
  );

  return (
    <UserNameContext.Provider value={value}>
      {children}
    </UserNameContext.Provider>
  );
}

export function useUserName() {
  const context = useContext(UserNameContext);
  if (!context) {
    throw new Error("useUserName must be used inside UserNameProvider");
  }

  return context;
}
