// The Discounts tab is being finished while the app is live on the App Store,
// so it stays out of sight until it is signed off. Production builds sit on
// the "production" EAS channel; the dev server and internal preview builds do
// not - so this shows the tab everywhere the work happens and nowhere a
// resident can reach it. That makes the branch safe to merge, and safe even
// if `ui-update` or `testflight` runs for some unrelated reason.
//
// To go live: delete this file and its two call sites - the `href` in
// app/(tabs)/_layout.tsx, and the guard around the card in app/(tabs)/index.tsx.
//
// Lives in utils/ rather than app/, because everything under app/ is a route.
//
// expo-updates is required lazily rather than imported at the top of the file.
// Expo Go ships no ExpoUpdates native module, and the import itself throws
// there - before any try/catch around a property read could catch it, taking
// the whole app down with it. Expo Go only ever runs dev bundles, so __DEV__
// short-circuits before the require is reached; a real build always has the
// module, and the catch is there for the case nobody has thought of.
export const DISCOUNTS_VISIBLE = (() => {
  if (__DEV__) return true;
  try {
    const Updates = require("expo-updates") as { channel: string | null };
    return Updates.channel !== "production";
  } catch {
    return false;
  }
})();
