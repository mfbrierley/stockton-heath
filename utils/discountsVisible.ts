import * as Updates from "expo-updates";

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
// Read inside a try/catch because this runs at module scope, where a throw
// would take the whole app down rather than just this one tab.
export const DISCOUNTS_VISIBLE = (() => {
  if (__DEV__) return true;
  try {
    return Updates.channel !== "production";
  } catch {
    return false;
  }
})();
