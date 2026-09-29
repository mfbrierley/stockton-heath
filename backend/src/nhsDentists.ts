// NHS dental practices near Stockton Heath and whether each is taking on new
// NHS patients, read once a day from the nhs.uk find-a-dentist pages.
//
// Read from the website rather than the NHS Service Search API because a
// production API key is not self-serve - it is requested from the national
// service desk, reviewed by hand, and has been reported to take months. The
// website carries the same acceptance status and more besides: the "Last
// confirmed" date a practice gives when it re-confirms its status is shown on
// nhs.uk but not exposed by the API at all.
//
// A plain fetch and an HTML parser are enough. The pages are rendered on the
// server, so a headless browser would only add a copy of Chromium to a droplet
// that already struggles for memory at build time.
//
// Two kinds of page are read:
//
// 1. The results page, for the list: every practice near Stockton Heath and a
//    first guess at its status. The parser leans on element ids nhs.uk puts on
//    every result, where N is the result's position on the page:
//
//      item_id_N                  ODS code, e.g. V006893
//      orgname_N / address_N      name and address
//      phone_N_link               phone number
//      profile_anchor_N           the practice's page
//      distance_N                 miles from the searched point
//      status_indicator_N_tag_K   "Routine check-ups", "Urgent dental care"...
//      result_item_N_li_K         each group it is accepting ("adults 18 or over")
//      not_accepting_patients_N   present when it is not listed as accepting
//      out_of_date_message_N      present when it has not confirmed either way
//      result_item_N_specialist   present when it only takes specialist referrals
//
// 2. Each practice's appointments page, for the final word. The results page
//    cannot tell "does not accept new NHS patients" from "has not confirmed
//    whether it does" - it shows the same not_accepting_patients_N block for
//    both (Cotswold Dental Care, September 2026) - where the practice's own
//    page says which, in the section between the routine-care-header and
//    urgent-care-header headings, along with its "Last confirmed" date in
//    dentist-accepting-patients-last-updated. Where a practice page can't be
//    read, the result page's status stands.
//
// If nhs.uk changes the results markup the page stops parsing, and a page this
// code does not fully understand is exactly when it could tell someone a
// practice is taking patients when it is not. So any result it cannot read
// fails the whole sync: the last good list is kept and served with its
// original fetchedAt, which the app shows, rather than a partial or guessed
// one. `npx tsx scripts/check-nhs-dentists.ts` shows what the parser makes of
// the live pages and is the first thing to run when the log says a sync failed.
//
// nhs.uk content is reusable under the Open Government Licence v3.0. The terms
// ask that it is refreshed every 24 hours (and at least every 7 days, or shown
// with an "as at" date), credited as information from the NHS website, and
// shown without NHS logos or branding. The app does all three.

import * as cheerio from "cheerio";
import {
  nhsDentistsDegraded,
  nhsDentistsRecovered,
  nhsDentistsStale,
} from "./email";
import type { PrismaClient } from "./generated/prisma/client";

export type DentistStatus =
  | "accepting"
  | "not_accepting"
  | "not_confirmed"
  | "referral_only";

type Accepting = { adults: boolean; children: boolean; freeCare: boolean };

type Group = keyof Accepting;

export type NhsDentist = {
  odsCode: string;
  name: string;
  address: string;
  /** As nhs.uk shows it, e.g. "01925 655037" */
  phone: string | null;
  distanceMiles: number;
  status: DentistStatus;
  /** Which groups of new NHS patients it is taking on. All false unless `status` is "accepting". */
  accepting: Accepting;
  /** Offers urgent NHS dental care */
  urgentCare: boolean;
  /** ISO date (YYYY-MM-DD) the practice last confirmed its status, if nhs.uk shows one */
  lastConfirmed: string | null;
  /** The practice's page on nhs.uk: the appointments page where it has one */
  nhsUrl: string;
  /**
   * The last time a daily read saw it start taking a group it was not taking
   * the day before, and which groups. Null until that has happened.
   */
  opened: { at: string; groups: Group[] } | null;
  /**
   * Where its postcode is, for the map - approximate, since a postcode covers
   * a few houses. Null if the postcode could not be looked up.
   */
  latitude: number | null;
  longitude: number | null;
};

/** What a practice's own appointments page says. */
export type PracticePage = Pick<
  NhsDentist,
  "status" | "accepting" | "lastConfirmed"
>;

// The same point the weather is fetched for. nhs.uk reports distances from it.
const LATITUDE = 53.3705;
const LONGITUDE = -2.5811;

export const NHS_DENTISTS_RESULTS_URL = `https://www.nhs.uk/service-search/find-a-dentist/results?location=Stockton%20Heath&latitude=${LATITUDE}&longitude=${LONGITUDE}`;

export const MAX_MILES = 5;

// nhs.uk returns the nearest 50 practices on one page, with no further pages.
// They currently reach about 8 miles, comfortably past MAX_MILES.
const RESULTS_PAGE_SIZE = 50;

// nhs.uk's robots.txt asks for five seconds between requests.
export const CRAWL_DELAY_MS = 5_000;

const REQUEST_TIMEOUT_MS = 30_000;

const USER_AGENT =
  "StocktonHeathApp/1.0 (community app; +https://stockton-heath-support.vercel.app)";

// The results page and the practice pages word the same groups differently.
const GROUPS: Record<string, keyof Accepting> = {
  "children aged 17 or under": "children",
  "adults 18 or over": "adults",
  "adults aged 18 or over": "adults",
  "adults entitled to free dental care": "freeCare",
  "adults entitled to free routine dental care": "freeCare",
};

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const clean = (text: string): string => text.replace(/\s+/g, " ").trim();

const noneAccepted = (): Accepting => ({
  adults: false,
  children: false,
  freeCare: false,
});

/**
 * Every practice on a find-a-dentist results page, in the order nhs.uk lists
 * them (nearest first). Throws if any result cannot be fully read.
 */
export function parseResults(html: string): NhsDentist[] {
  const $ = cheerio.load(html);
  const dentists: NhsDentist[] = [];

  $('[id^="item_id_"]').each((_, element) => {
    const n = $(element).attr("id")!.slice("item_id_".length);
    const odsCode = clean($(element).text());
    const name = clean($(`#orgname_${n}`).text());
    const address = clean($(`#address_${n}`).text());
    const distanceMiles = Number.parseFloat($(`#distance_${n}`).text());
    const profileUrl = $(`#profile_anchor_${n}`).attr("href") ?? "";
    const phone = clean($(`#phone_${n}_link`).text()) || null;

    if (!/^[A-Z0-9]+$/.test(odsCode) || !name || !address) {
      throw new Error(`result ${n} is missing its code, name or address`);
    }
    if (!Number.isFinite(distanceMiles)) {
      throw new Error(`result ${n} (${name}) has no distance`);
    }
    // The app opens this link, so it must go to nhs.uk and nowhere else.
    if (!profileUrl.startsWith("https://www.nhs.uk/services/dentist/")) {
      throw new Error(`result ${n} (${name}) has an unexpected link: ${profileUrl}`);
    }

    const accepting = noneAccepted();
    const groups = $(`[id^="result_item_${n}_li_"]`);
    groups.each((_, li) => {
      const text = clean($(li).text()).toLowerCase();
      const group = GROUPS[text];
      if (!group) throw new Error(`result ${n} (${name}) accepts an unknown group: "${text}"`);
      accepting[group] = true;
    });

    let status: DentistStatus;
    if (groups.length > 0) status = "accepting";
    else if ($(`#not_accepting_patients_${n}`).length) status = "not_accepting";
    else if ($(`#out_of_date_message_${n}`).length) status = "not_confirmed";
    else if ($(`#result_item_${n}_specialist`).length) status = "referral_only";
    else throw new Error(`result ${n} (${name}) has no status this code recognises`);

    const tags = $(`[id^="status_indicator_${n}_tag_"]`)
      .map((_, tag) => clean($(tag).text()).toLowerCase())
      .get();

    dentists.push({
      odsCode,
      name,
      address,
      phone,
      distanceMiles,
      status,
      accepting,
      urgentCare: tags.includes("urgent dental care"),
      lastConfirmed: null,
      opened: null,
      latitude: null,
      longitude: null,
      // Specialist-only practices have no appointments page (it is a 404).
      nhsUrl:
        status === "referral_only"
          ? profileUrl
          : `${profileUrl.replace(/\/+$/, "")}/appointments`,
    });
  });

  if (dentists.length === 0) {
    throw new Error("no results found on the page");
  }

  return dentists;
}

/** "Last confirmed: 7 September 2026" as 2026-09-07. */
const parseDate = (text: string): string | null => {
  const match = /(\d{1,2}) ([a-z]+) (\d{4})/i.exec(text);
  if (!match) return null;

  const month = MONTHS.indexOf(match[2].toLowerCase());
  if (month === -1) return null;

  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
};

/**
 * The routine-care status a practice's appointments page gives, or null if
 * the page says something this code does not recognise.
 */
export function parsePracticePage(html: string): PracticePage | null {
  const $ = cheerio.load(html);
  const section = $("#routine-care-header").nextUntil("#urgent-care-header");
  const text = clean(section.text()).toLowerCase();
  const lastConfirmed = parseDate(
    clean($("#dentist-accepting-patients-last-updated").text()),
  );

  if (text.includes("has not confirmed")) {
    return { status: "not_confirmed", accepting: noneAccepted(), lastConfirmed };
  }
  if (text.includes("does not currently accept new nhs patients")) {
    return { status: "not_accepting", accepting: noneAccepted(), lastConfirmed };
  }
  // Several groups are listed after "if they are:"; a single group is written
  // into the sentence instead - "currently only accepts new NHS patients for
  // routine dental care if they are children aged 17 or under." - above an
  // empty list.
  const intro = clean(section.filter("p").first().text()).toLowerCase();
  const accepts =
    /currently (?:only )?accepts new nhs patients for routine dental care if they are:?(.*)$/.exec(
      intro,
    );
  if (accepts) {
    const groups = section
      .find("li")
      .toArray()
      .map((li) => clean($(li).text()).toLowerCase());
    const inline = accepts[1].replace(/\.$/, "").trim();
    if (inline) groups.push(inline);
    if (groups.length === 0) return null;

    const accepting = noneAccepted();
    for (const text of groups) {
      const group = GROUPS[text];
      if (!group) return null;
      accepting[group] = true;
    }
    return { status: "accepting", accepting, lastConfirmed };
  }
  return null;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.text();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// ── Map positions ─────────────────────────────────────────────────────────────
//
// nhs.uk gives no coordinates, so each practice is placed on the map by its
// postcode, looked up on postcodes.io: free, no key, and built on the ONS
// Postcode Directory, which is under the Open Government Licence like the NHS
// data. One request covers the whole list, and positions are carried over
// between syncs, so in practice only a new practice is ever looked up.

const POSTCODES_URL = "https://api.postcodes.io/postcodes";

const postcodeOf = (address: string): string | null =>
  /([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/i.exec(address.trim())?.[1].toUpperCase() ?? null;

/**
 * Fill in latitude and longitude, reusing the last known position of any
 * practice at the same postcode. Never throws: a failed lookup leaves the
 * practice off the map, and it stays in the list.
 */
async function locate(
  dentists: NhsDentist[],
  known: NhsDentist[],
): Promise<NhsDentist[]> {
  const positions = new Map<string, { latitude: number; longitude: number }>();
  for (const d of known) {
    const postcode = postcodeOf(d.address);
    if (postcode && d.latitude !== null && d.longitude !== null) {
      positions.set(postcode, { latitude: d.latitude, longitude: d.longitude });
    }
  }

  const missing = [
    ...new Set(
      dentists
        .map((d) => postcodeOf(d.address))
        .filter((p): p is string => p !== null && !positions.has(p)),
    ),
  ];
  if (missing.length) {
    try {
      const res = await fetch(POSTCODES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        body: JSON.stringify({ postcodes: missing }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`${res.status} from postcodes.io`);
      const json = (await res.json()) as {
        result: {
          query: string;
          result: { latitude: number | null; longitude: number | null } | null;
        }[];
      };
      for (const { query, result } of json.result) {
        if (result?.latitude != null && result.longitude != null) {
          positions.set(query.toUpperCase(), {
            latitude: result.latitude,
            longitude: result.longitude,
          });
        }
      }
    } catch (error) {
      console.warn(
        `NHS dentists: could not look up ${missing.length} postcode(s) for the map:`,
        message(error),
      );
    }
  }

  return dentists.map((d) => {
    const position = positions.get(postcodeOf(d.address) ?? "");
    return {
      ...d,
      latitude: position?.latitude ?? null,
      longitude: position?.longitude ?? null,
    };
  });
}

// ── Keeping the list ──────────────────────────────────────────────────────────
//
// The list is saved to AppMeta after every sync and loaded at boot, so a
// deploy or restart serves the last good list straight away instead of a 503,
// and does not read nhs.uk again unless a day has passed. The previous list is
// also what each sync is compared with, to spot practices that have started
// taking patients; those changes are logged to NhsDentistChange as a history.

type Snapshot = { data: NhsDentist[]; fetchedAt: number };

// "stale": no successful read of the results page for STALE_AFTER_MS.
// "degraded": the last read worked, but too many practice pages could not be
// used - usually nhs.uk rewording them.
type Health = "ok" | "stale" | "degraded";

const SYNC_EVERY_MS = 24 * 60 * 60 * 1000;

// Checked hourly, so a failed read is retried within the hour rather than the
// next day. The half hour of slack stops the daily read drifting an hour
// later each day.
const CHECK_EVERY_MS = 60 * 60 * 1000;
const DUE_AFTER_MS = SYNC_EVERY_MS - 30 * 60 * 1000;

// Two days of hourly retries failing is not nhs.uk having a bad moment.
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

// The odd practice page timing out is normal; a fifth of them failing is not.
// Any page that loads but is not recognised counts, however few.
const MAX_FAILED_SHARE = 0.2;

const SNAPSHOT_KEY = "nhsDentists";
const HEALTH_KEY = "nhsDentistsHealth";

const GROUPS_IN_ORDER: Group[] = ["adults", "children", "freeCare"];
const groupsOf = (accepting: Accepting): Group[] =>
  GROUPS_IN_ORDER.filter((group) => accepting[group]);

let db: PrismaClient | null = null;
let cached: Snapshot | null = null;
let syncing = false;
let health: Health = "ok";
// Why the last read of the results page failed, for the "stale" email.
let lastError: string | null = null;
// The practice pages the last sync could not use, when there were enough to
// count as degraded; null when it read them normally. Undefined until a sync
// finishes after boot - until then nothing is known about them, and a saved
// "degraded" must stand rather than be taken for a recovery.
let pageReport: { attempted: number; problems: string[] } | null | undefined;

export const getCachedNhsDentists = () => cached;

const saveMeta = async (key: string, value: string): Promise<void> => {
  if (!db) return;
  try {
    await db.appMeta.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  } catch (error) {
    console.warn(`NHS dentists: could not save ${key}:`, message(error));
  }
};

async function load(): Promise<void> {
  if (!db) return;
  try {
    const rows = await db.appMeta.findMany({
      where: { key: { in: [SNAPSHOT_KEY, HEALTH_KEY] } },
    });
    for (const row of rows) {
      if (row.key === SNAPSHOT_KEY) {
        const snapshot = JSON.parse(row.value) as Snapshot;
        if (Array.isArray(snapshot.data) && typeof snapshot.fetchedAt === "number") {
          cached = {
            fetchedAt: snapshot.fetchedAt,
            // Filtered again in case MAX_MILES has shrunk since it was saved;
            // otherwise the old radius would be served until the next read.
            data: snapshot.data
              .filter((d) => d.distanceMiles <= MAX_MILES)
              .map((d) => ({
                ...d,
                opened: d.opened ?? null,
                latitude: d.latitude ?? null,
                longitude: d.longitude ?? null,
              })),
          };
        }
      } else if (["ok", "stale", "degraded"].includes(row.value)) {
        health = row.value as Health;
      }
    }
    if (cached) {
      console.log(
        `NHS dentists: loaded the saved list from ${new Date(cached.fetchedAt).toISOString()} (${cached.data.length} practices).`,
      );
    }
  } catch (error) {
    console.warn("NHS dentists: could not load the saved list - starting empty:", message(error));
  }
}

/**
 * A practice page that could not be read leaves only the results page's
 * status, which cannot tell "not accepting" from "not confirmed" and has no
 * date. When the results page shows the same groups as yesterday, nothing it
 * can see has changed, so yesterday's fuller reading is kept rather than
 * thrown away over one failed request.
 */
const fallBack = (
  listed: NhsDentist,
  earlier: NhsDentist | undefined,
): NhsDentist =>
  earlier &&
  earlier.status !== "referral_only" &&
  groupsOf(earlier.accepting).join() === groupsOf(listed.accepting).join()
    ? {
        ...listed,
        status: earlier.status,
        accepting: earlier.accepting,
        lastConfirmed: earlier.lastConfirmed,
      }
    : listed;

/**
 * Refresh the list. Never throws: a failure is logged and the last good list
 * is kept.
 *
 * Reading every practice page takes a few minutes, five seconds apart, so the
 * new list is built on the side and published in one go when it is finished;
 * until then the app keeps getting the previous one. The exception is a first
 * sync with no saved list at all, when the results page is served straight
 * away rather than a 503 for those minutes.
 */
export async function syncNhsDentists(): Promise<void> {
  // A slow sweep must never overlap the next one.
  if (syncing) return;
  syncing = true;

  try {
    const fetchedAt = Date.now();
    let listed: NhsDentist[];
    try {
      listed = parseResults(await fetchPage(NHS_DENTISTS_RESULTS_URL));
    } catch (error) {
      lastError = message(error);
      console.error(
        `[${new Date().toISOString()}] NHS dentists sync failed - retaining last cached data: ${lastError}`,
      );
      return;
    }
    lastError = null;

    const furthest = listed[listed.length - 1].distanceMiles;
    if (listed.length >= RESULTS_PAGE_SIZE && furthest < MAX_MILES) {
      console.warn(
        `NHS dentists: nhs.uk's ${RESULTS_PAGE_SIZE}-result page now ends at ${furthest} miles, short of ${MAX_MILES}. Practices beyond that are missing from the list.`,
      );
    }
    listed = listed.filter((d) => d.distanceMiles <= MAX_MILES);

    const before = new Map((cached?.data ?? []).map((d) => [d.odsCode, d]));
    if (!cached) cached = { data: listed, fetchedAt };

    const read: NhsDentist[] = [];
    const problems: string[] = [];
    let attempted = 0;
    let failed = 0;
    let unrecognised = 0;
    for (const dentist of listed) {
      if (dentist.status === "referral_only") {
        read.push(dentist);
        continue;
      }

      attempted++;
      await sleep(CRAWL_DELAY_MS);
      let page: PracticePage | null = null;
      try {
        page = parsePracticePage(await fetchPage(dentist.nhsUrl));
        if (!page) {
          unrecognised++;
          problems.push(`${dentist.name}: page not recognised - ${dentist.nhsUrl}`);
        }
      } catch (error) {
        failed++;
        problems.push(`${dentist.name}: ${message(error)}`);
      }
      read.push(
        page ? { ...dentist, ...page } : fallBack(dentist, before.get(dentist.odsCode)),
      );
    }

    // Compare with the previous list. A practice with nothing to compare
    // with - the very first sync, or one new to the area - has no history.
    const detectedAt = new Date(fetchedAt).toISOString();
    const changes: {
      odsCode: string;
      name: string;
      detectedAt: string;
      fromStatus: string;
      toStatus: string;
      fromGroups: string;
      toGroups: string;
    }[] = [];
    const data = read.map((d) => {
      const earlier = before.get(d.odsCode);
      if (!earlier) return d;

      const fromGroups = groupsOf(earlier.accepting).join(",");
      const toGroups = groupsOf(d.accepting).join(",");
      if (earlier.status !== d.status || fromGroups !== toGroups) {
        changes.push({
          odsCode: d.odsCode,
          name: d.name,
          detectedAt,
          fromStatus: earlier.status,
          toStatus: d.status,
          fromGroups,
          toGroups,
        });
      }

      const gained = groupsOf(d.accepting).filter((g) => !earlier.accepting[g]);
      return {
        ...d,
        opened: gained.length ? { at: detectedAt, groups: gained } : earlier.opened ?? null,
      };
    });

    cached = { data: await locate(data, [...before.values()]), fetchedAt };
    pageReport =
      unrecognised > 0 || (attempted > 0 && failed / attempted > MAX_FAILED_SHARE)
        ? { attempted, problems }
        : null;

    await saveMeta(SNAPSHOT_KEY, JSON.stringify(cached));
    if (changes.length && db) {
      try {
        await db.nhsDentistChange.createMany({ data: changes });
      } catch (error) {
        console.warn(
          `NHS dentists: could not record ${changes.length} change(s) - has the NhsDentistChange migration been applied?`,
          message(error),
        );
      }
    }

    console.log(
      `[${new Date().toISOString()}] NHS dentists synced. ${data.length} practice(s), ${data.filter((d) => d.accepting.adults).length} accepting adults, ${changes.length} change(s) since the last sync. Read ${attempted - failed - unrecognised} of ${attempted} practice page(s)${problems.length ? `; could not use: ${problems.join("; ")}` : ""}.`,
    );
  } catch (error) {
    console.error("NHS dentists sync error:", error);
  } finally {
    syncing = false;
  }
}

/** Emails the owner when the list stops updating, and again when it recovers. */
async function checkHealth(): Promise<void> {
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;
  const next: Health =
    age > STALE_AFTER_MS
      ? "stale"
      : pageReport === undefined
        ? health === "degraded"
          ? "degraded"
          : "ok"
        : pageReport
          ? "degraded"
          : "ok";
  if (next === health) return;

  // Saved so a restart does not send the same email again.
  health = next;
  await saveMeta(HEALTH_KEY, next);

  if (next === "stale") nhsDentistsStale(cached?.fetchedAt ?? null, lastError);
  else if (next === "degraded" && pageReport)
    nhsDentistsDegraded(pageReport.attempted, pageReport.problems);
  else if (next === "ok" && cached) nhsDentistsRecovered(cached.fetchedAt);
}

async function tick(): Promise<void> {
  try {
    if (!cached || Date.now() - cached.fetchedAt > DUE_AFTER_MS) {
      await syncNhsDentists();
    }
    await checkHealth();
  } catch (error) {
    console.error("NHS dentists check error:", error);
  }
}

/**
 * Load the saved list, then read nhs.uk whenever it is a day old - checked
 * hourly, so a failed read is retried within the hour.
 */
export function startNhsDentists(prisma: PrismaClient): void {
  db = prisma;
  void (async () => {
    await load();
    // A list saved before positions existed, or when postcodes.io was down,
    // gets them now rather than waiting for the next day's read.
    if (cached?.data.some((d) => d.latitude === null)) {
      const located = await locate(cached.data, cached.data);
      if (cached) {
        cached = { ...cached, data: located };
        await saveMeta(SNAPSHOT_KEY, JSON.stringify(cached));
      }
    }
    await tick();
    setInterval(() => void tick(), CHECK_EVERY_MS);
  })();
}
