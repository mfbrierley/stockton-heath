/**
 * Every external source the app draws information from, with a public page
 * someone can actually open.
 *
 * Google Play's Misleading Claims policy requires an app that shows government
 * information to name its sources and link to them, and it checks that those
 * links work. Keep the URLs here so the About screen, the store listing and the
 * inline notes on each screen can never drift apart, and check a URL still
 * resolves - and is not a withdrawn page - before changing it. Link to a
 * human-readable page, not an API endpoint: the Fuel Finder API host answers a
 * browser with 403, which reads as a broken link.
 *
 * Sources fall into two groups, and the store listing splits them the same way:
 *
 *   "live"   - the app fetches this every time you open the screen.
 *   "manual" - the wording was copied from the publisher's page by hand. It is
 *              checked periodically, not fetched, so it can fall behind. Every
 *              screen showing this kind of content links out and says so.
 *
 * Claiming a "manual" source is live is the misleading claim Play looks for, so
 * do not move an entry between groups without changing the code to match.
 */
export type SourceGroup = "live" | "manual";

export type DataSource = {
  /** Feather icon name used on the About screen */
  icon: string;
  name: string;
  detail: string;
  url: string;
  /** Shown on the About screen when the source is a government body */
  government?: boolean;
  group: SourceGroup;
};

// ── Live sources ──────────────────────────────────────────────────────────────

export const OPENWEATHER_URL = "https://openweathermap.org";

/**
 * The Fuel Finder collection page on GOV.UK. Not the old guidance page
 * (/guidance/access-fuel-price-data): GOV.UK withdrew it on 1 May 2026 and it
 * now renders a "withdrawn" banner, which a Play reviewer reads as a dead source.
 */
export const FUEL_FINDER_URL =
  "https://www.gov.uk/government/collections/fuel-finder";

export const WARRINGTON_BINS_URL = "https://www.warrington.gov.uk/bins";

export const BANK_HOLIDAYS_URL = "https://www.gov.uk/bank-holidays";

/**
 * The council's own swing bridges page. It names @trafficwarr as the handle that
 * "posts an automated tweet 25-30 minutes before the swing bridges are due to
 * open", which makes the council - not X - the publisher of the alerts. Prefer
 * this over the X link: a reviewer who meets X's login wall on x.com/trafficwarr
 * cannot verify the source, and can on warrington.gov.uk.
 */
export const SWING_BRIDGES_URL = "https://www.warrington.gov.uk/swingbridges";

/** The account itself, for the rare place that needs to point at the feed. */
export const TRAFFICWARR_URL = "https://x.com/trafficwarr";

// ── Hand-copied sources ───────────────────────────────────────────────────────

export const SANDY_LANE_CRC_URL =
  "https://www.warrington.gov.uk/stockton-heath-community-recycling-centre";
export const WOOLSTON_CRC_URL =
  "https://www.warrington.gov.uk/woolston-community-recycling-centre";
export const BROOMFIELDS_URL =
  "https://livewirewarrington.co.uk/leisure/leisure-centres/broomfields-leisure-centre/";
export const POST_OFFICE_URL =
  "https://www.postoffice.co.uk/branch-finder/3194345/stockton-heath";
export const STOCKTON_HEATH_MC_URL =
  "https://www.stocktonheathmedicalcentre.co.uk/";
export const LATCHFORD_MC_URL = "https://www.latchfordmedicalcentre.co.uk/";
export const STRETTON_MC_URL = "https://www.strettonmedicalcentre.co.uk/";
export const NHS_URL = "https://www.nhs.uk";

/**
 * The standard opener for a SourceNote under hand-copied content. Says the two
 * things Play wants said: this is not live, and here is the publisher.
 */
export const MANUAL_SOURCE_LABEL =
  "Copied from the publisher by hand and checked periodically, not updated live - please confirm before you travel. Source:";

export const DATA_SOURCES: DataSource[] = [
  // ── Updated automatically ───────────────────────────────────────────────────
  {
    icon: "cloud",
    name: "OpenWeather",
    detail: "One Call API 3.0 - temperature, wind, rain and sunset",
    url: OPENWEATHER_URL,
    group: "live",
  },
  {
    icon: "droplet",
    name: "Fuel Finder (UK Government)",
    detail:
      "Petrol and diesel prices at nearby stations, refreshed every 30 minutes",
    url: FUEL_FINDER_URL,
    government: true,
    group: "live",
  },
  {
    icon: "trash-2",
    name: "Warrington Borough Council",
    detail: "Address lookup and bin collection days for your address",
    url: WARRINGTON_BINS_URL,
    government: true,
    group: "live",
  },
  {
    icon: "calendar",
    name: "GOV.UK bank holidays",
    detail:
      "England and Wales bank holiday dates, used to work out recycling centre opening hours",
    url: BANK_HOLIDAYS_URL,
    government: true,
    group: "live",
  },
  {
    icon: "bell",
    name: "Warrington Borough Council swing bridge alerts",
    detail:
      "The council's automated alert feed, posted as @trafficwarr on X 25-30 minutes before a bridge opens. The app reads those posts through twitterapi.io, a third-party service.",
    url: SWING_BRIDGES_URL,
    government: true,
    group: "live",
  },

  // ── Copied by hand, checked periodically ────────────────────────────────────
  {
    icon: "refresh-cw",
    name: "Warrington Borough Council - Stockton Heath recycling centre",
    detail: "Opening hours, accepted, prohibited and permit item lists",
    url: SANDY_LANE_CRC_URL,
    government: true,
    group: "manual",
  },
  {
    icon: "refresh-cw",
    name: "Warrington Borough Council - Woolston recycling centre",
    detail: "Opening hours, accepted, prohibited and permit item lists",
    url: WOOLSTON_CRC_URL,
    government: true,
    group: "manual",
  },
  {
    icon: "activity",
    name: "LiveWire Warrington",
    detail:
      "Broomfields Leisure Centre opening hours, facilities and contact details",
    url: BROOMFIELDS_URL,
    group: "manual",
  },
  {
    icon: "mail",
    name: "Post Office",
    detail: "Stockton Heath branch opening hours and services",
    url: POST_OFFICE_URL,
    group: "manual",
  },
  {
    icon: "heart",
    name: "Stockton Heath Medical Centre",
    detail: "Opening hours, address and phone number",
    url: STOCKTON_HEATH_MC_URL,
    group: "manual",
  },
  {
    icon: "heart",
    name: "Latchford Medical Centre",
    detail: "Opening hours, address and phone number",
    url: LATCHFORD_MC_URL,
    group: "manual",
  },
  {
    icon: "heart",
    name: "Stretton Medical Centre",
    detail: "Opening hours, address and phone number",
    url: STRETTON_MC_URL,
    group: "manual",
  },
  {
    icon: "plus-square",
    name: "NHS",
    detail:
      "Links to the NHS App, eConsult and SystmOnline from the medical centre screens",
    url: NHS_URL,
    group: "manual",
  },
];

export const LIVE_SOURCES = DATA_SOURCES.filter((s) => s.group === "live");
export const MANUAL_SOURCES = DATA_SOURCES.filter((s) => s.group === "manual");

/** The URL as it should read on screen - the scheme is noise to someone reading it. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
