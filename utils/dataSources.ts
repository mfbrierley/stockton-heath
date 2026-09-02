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
export const FUEL_FINDER_URL =
  "https://www.gov.uk/guidance/access-fuel-price-data";

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
    name: "@trafficwarr",
    detail: "Swing bridge closure announcements",
    url: "https://x.com/trafficwarr",
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
