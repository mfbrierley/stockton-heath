/**
 * Every external source the app draws data from, with a public page someone can
 * actually open.
 *
 * Google Play's Misleading Claims policy requires an app that shows government
 * information to name its sources and link to them, and it checks that those
 * links work. Keep the URLs here so the About screen and the inline notes on
 * each screen can never drift apart, and check a URL still resolves before
 * changing it. Link to a human-readable page, not an API endpoint: the Fuel
 * Finder API host answers a browser with 403, which reads as a broken link.
 */
export type DataSource = {
  /** Feather icon name used on the About screen */
  icon: string;
  name: string;
  detail: string;
  url: string;
  /** Shown on the About screen when the source is a government body */
  government?: boolean;
};

export const WARRINGTON_BINS_URL = "https://www.warrington.gov.uk/bins";
/**
 * The Fuel Finder collection page on GOV.UK. Not the old guidance page
 * (/guidance/access-fuel-price-data): GOV.UK withdrew it on 1 May 2026 and it
 * now renders a "withdrawn" banner, which a Play reviewer reads as a dead source.
 */
export const FUEL_FINDER_URL =
  "https://www.gov.uk/government/collections/fuel-finder";
/**
 * The X account the backend polls for swing bridge posts. It is a third-party
 * feed and the app says so wherever it is credited, so a reviewer who meets X's
 * login prompt reads it as a social account, not a broken government link.
 */
export const TRAFFICWARR_URL = "https://x.com/trafficwarr";

export const DATA_SOURCES: DataSource[] = [
  {
    icon: "cloud",
    name: "OpenWeather",
    detail: "One Call API 3.0 - weather data",
    url: "https://openweathermap.org",
  },
  {
    icon: "droplet",
    name: "Fuel Finder (UK Government)",
    detail: "Petrol and diesel prices at nearby stations",
    url: FUEL_FINDER_URL,
    government: true,
  },
  {
    icon: "twitter",
    name: "Traffic Warrington (@trafficwarr)",
    detail:
      "Swing bridge closure posts on X - a third-party account the app monitors",
    url: TRAFFICWARR_URL,
  },
  {
    icon: "map-pin",
    name: "Warrington Borough Council",
    detail: "Bin collection days for your address",
    url: WARRINGTON_BINS_URL,
    government: true,
  },
];

/** The URL as it should read on screen - the scheme is noise to someone reading it. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
