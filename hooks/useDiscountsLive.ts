import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

// Whether the Discounts tab, and the card on Home that leads to it, should be
// showing. True once the backend's public list has something in it.
//
// The backend is the switch: it returns an empty list until launch day
// (backend/src/launch.ts), however much is approved and paid for. So the tab
// appears on launch day by itself, without a build or an update having to go
// out that day - and it never appears empty, before launch or after, because
// an empty list keeps it hidden. Moving the launch is a backend change alone.
//
// One request shared by every caller, made at start-up and again whenever the
// app comes back to the foreground: someone who leaves the app open across
// midnight on launch day sees the tab next time they look at it. Until the
// first answer arrives, and if it never does, the tab stays hidden - a missing
// tab is a far smaller fault than one that opens onto nothing.
//
// Always on in development, so the screen can be worked on before launch.

let live = false;
let inFlight = false;
const listeners = new Set<() => void>();

const setLive = (next: boolean) => {
  if (next === live) return;
  live = next;
  listeners.forEach((listener) => listener());
};

const check = async () => {
  if (inFlight) return;
  inFlight = true;
  try {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!backendUrl) return;
    const res = await fetch(`${backendUrl}/business-listings`);
    if (!res.ok) return;
    const json: unknown = await res.json();
    setLive(Array.isArray(json) && json.length > 0);
  } catch {
    // Offline or the backend is down: keep whatever was last known.
  } finally {
    inFlight = false;
  }
};

let started = false;
const start = () => {
  if (started) return;
  started = true;
  void check();
  AppState.addEventListener("change", (state) => {
    if (state === "active") void check();
  });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useDiscountsLive(): boolean {
  useEffect(start, []);
  const current = useSyncExternalStore(subscribe, () => live);
  return __DEV__ || current;
}
