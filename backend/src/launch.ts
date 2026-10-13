// When Local Offers opens to residents, and the free month that comes first.
//
// Two dates, and two promises made in the outreach email:
//
// - Nothing is shown in the app before LAUNCH_AT. The public listings route
//   returns an empty list until then, and the app only shows its Discounts
//   tab once that list has something in it - so the page appears on launch
//   day by itself, without anything being shipped on the day.
// - Anyone who starts their subscription before LAUNCH_AT pays nothing until
//   FREE_UNTIL. A fixed date rather than a 30-day trial, or someone who signed
//   up early would be billed before the month residents can actually see.
//   Starting after LAUNCH_AT is charged straight away.
//
// Both are UK midnight. The clocks go back on 25 October 2026, so on both
// dates the UK is on GMT and midnight is 00:00 UTC.

const DEFAULT_LAUNCH_AT = "2026-10-30T00:00:00Z";

// Fixed in code rather than read from the environment: it is a date businesses
// have been promised in writing, and nothing about running the server should
// be able to move it.
export const FREE_UNTIL = new Date("2026-11-30T00:00:00Z");

// Stripe refuses a trial_end less than 48 hours away. An hour of margin on
// top, so a checkout created right at the edge isn't turned away by Stripe's
// clock disagreeing with ours.
const MIN_TRIAL_LEAD_MS = 49 * 60 * 60 * 1000;

let invalidLaunchWarned = false;

// LOCAL_OFFERS_LAUNCH_AT can move the launch - to put it back if too few
// discounts are approved in time - without a code change. Optional, and read
// rather than required: a missing or unreadable value falls back to the date
// above and is logged, never thrown, because a boot failure would take the
// weather, bins, fuel and bridge alerts down with it.
export const launchAt = (): Date => {
  const raw = process.env.LOCAL_OFFERS_LAUNCH_AT?.trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    if (!invalidLaunchWarned) {
      console.error(
        `LOCAL_OFFERS_LAUNCH_AT is not a date (${raw}) - using ${DEFAULT_LAUNCH_AT}`,
      );
      invalidLaunchWarned = true;
    }
  }
  return new Date(DEFAULT_LAUNCH_AT);
};

export const isLaunched = (now: Date = new Date()): boolean =>
  now.getTime() >= launchAt().getTime();

// The trial_end for a checkout starting now, in Unix seconds, or null when it
// should be charged straight away. Decided when the checkout is created:
// "signing up before launch" means starting the subscription before launch.
export const freeMonthTrialEnd = (now: Date = new Date()): number | null => {
  if (isLaunched(now)) return null;
  if (FREE_UNTIL.getTime() - now.getTime() < MIN_TRIAL_LEAD_MS) return null;
  return Math.floor(FREE_UNTIL.getTime() / 1000);
};

// "30 October", as a business reads it in an email.
export const ukDate = (date: Date): string =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  });
