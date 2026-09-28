# NHS dentists taking on patients - plan

## Context
Finding an NHS dentist that is taking on new patients is a common local frustration. Today the only way to check is to go through nhs.uk one practice at a time. The app already brings local services together (bins, fuel, bridge, medical centres), so a daily list of nearby NHS dental practices, each showing whether it is taking on new NHS patients, fits naturally.

Decisions made with the user:
- **Placement.** A new "NHS Dentists" link in the Services tab's Local Services section, beside Medical Centres. It opens a list screen.
- **Area.** Every NHS dental practice within **8 miles** of Stockton Heath, nearest first. There is one list for everyone, fetched by the backend, following the fuel-prices pattern.
- **No push alerts.** The list screen only.
- **Data source.** A daily **scrape of nhs.uk find-a-dentist** by the backend.
  - It uses a plain HTTP fetch plus an HTML parser, not Playwright. The page is server-rendered, and Chromium would not fit well on the droplet's 512 MB of RAM.
  - The official Service Search API v3 is out of scope. Its production key is not self-serve, and one developer reported waiting more than 4 months.

### What the research established (checked 28 Sep 2026)
- **One page covers the whole area.** `GET https://www.nhs.uk/service-search/find-a-dentist/results?location=Stockton%20Heath&latitude=53.3705&longitude=-2.5811` returns 200 with the **nearest 50 practices**, which currently reach exactly 8.0 miles. There are no pagination links.
- **Each result carries stable element IDs** (N is the result index):

  | ID | What it holds |
  |---|---|
  | `item_id_N` | ODS code, e.g. `V006893` |
  | `orgname_N` | practice name |
  | `address_N` | address |
  | `phone_N_link` | phone number, from the `tel:` href and the link text |
  | `profile_anchor_N` | practice page URL |
  | `distance_N` | distance in miles |
  | `status_indicator_N_tag_K` | tags: "Routine check-ups", "Urgent dental care", "Specialist dental care" |

- **There are four status variants per result:**
  1. **Accepting.** `result_item_N_li_K` list items read "children aged 17 or under", "adults 18 or over" or "adults entitled to free dental care".
  2. **Not accepting.** A `not_accepting_patients_N` element is present.
  3. **Not confirmed.** An `out_of_date_message_N` element is present ("has not confirmed if they are accepting…").
  4. **Referral only.** The text "Only accepting new NHS patients for specialist dental care by referral".
- **"Last confirmed" date.** This is only on each practice's appointments page, `{profile URL}/appointments`, in `<p id="dentist-accepting-patients-last-updated">Last confirmed: 7 September 2026</p>`. The API does not expose this date.
- **robots.txt** does not disallow these paths. It sets `Crawl-Delay: 5`.
- **Licence and attribution.** nhs.uk content is under the OGL, which allows commercial use.
  - Credit it as "Information from the NHS website" with a link.
  - State that it is "licensed under the Open Government Licence v3.0".
  - Refresh it every 24 hours; this is recommended, and at least every 7 days is required. Otherwise show an "as at" date.
  - Use **no NHS logo or branding**.

## Backend

### New module `backend/src/nhsDentists.ts`
Keep this out of the 2,293-line `index.ts`, the same way `email.ts` and `subscription.ts` are separate.

- **Constants**
  - `RESULTS_URL`: the results URL above. The lat/lon match the weather coordinates in `app/(tabs)/index.tsx:20-21`.
  - `MAX_MILES = 8`
  - `CRAWL_DELAY_MS = 5000`
  - `USER_AGENT`: names the app and gives the support site URL as a contact.
- **Type `NhsDentist`**, exported for the route:
  ```ts
  type DentistStatus = "accepting" | "not_accepting" | "not_confirmed" | "referral_only";
  type NhsDentist = {
    odsCode: string; name: string; address: string; phone: string | null;
    distanceMiles: number; status: DentistStatus;
    accepting: { adults: boolean; children: boolean; freeCare: boolean };
    urgentCare: boolean;               // "Urgent dental care" tag
    lastConfirmed: string | null;      // ISO date, from the appointments page
    nhsUrl: string;                    // absolute practice appointments-page URL
  };
  ```
- **`parseResults(html): NhsDentist[]`**
  - A pure function using **`cheerio`**, the one new backend dependency. It is small and needs no native build, so it doesn't repeat the image-bloat history in PROJECT_CONTEXT.
  - Iterate `[id^=item_id_]` and read the sibling IDs by index.
  - Unknown list-item text logs a warning but still counts as "accepting".
  - Drop results over `MAX_MILES`.
- **`parseLastConfirmed(html): string | null`**
  - Reads `#dentist-accepting-patients-last-updated`, strips "Last confirmed:" and converts to an ISO date.
- **Cache.** `let cached: { data: NhsDentist[]; fetchedAt: number } | null`, with `getCachedNhsDentists()` to read it.
- **`syncNhsDentists()`** never throws; everything is wrapped in try/catch like `syncFuelPrices()` (`index.ts:125-184`). Steps:
  1. Fetch the results page and parse it.
  2. **Sanity check.** Treat the fetch as failed if nothing parses, or if any result lacks an ODS code, name or recognised status. This would catch a markup change or a bot-challenge page. On failure, log an error and **keep the last good cache**.
  3. Publish straight away. Carry `lastConfirmed` over from the previous cache by ODS code, so the app never waits on step 4.
  4. Fetch each practice's appointments page in turn, `CRAWL_DELAY_MS` apart. That is about 50 pages, roughly 4 to 5 minutes, once a day. Update `lastConfirmed` in the cache as each one arrives. A failed page keeps its previous date.
  5. If the page returned 50 results and the furthest is under 8 miles, log a warning that the nearest-50 cap is now cutting off the radius.

### `backend/src/index.ts`
- **Route**, beside `/fuel-prices` (`index.ts:690-695`), with the same shape and 503 behaviour:
  `app.get("/nhs-dentists", …)` returns `{ data, fetchedAt }`, or `503 { error: "NHS dentists not yet available" }` while the cache is empty.
- **Schedule**, beside the fuel poller (`index.ts:2262-2276`):
  `void syncNhsDentists();` at boot, then `setInterval(..., 24 * 60 * 60 * 1000)`.
- **No new env vars, no database table and no migration.**

### `backend/scripts/check-nhs-dentists.ts`
A dev check run with `npx tsx scripts/check-nhs-dentists.ts`. It fetches the live page, runs `parseResults`, and prints a table: ODS, miles, status, categories, name.
- This is the first thing to run when nhs.uk changes its markup.
- The repo has no test framework, so this stands in for one.

## App

### `components/LocalPlacesSection.tsx`
Add a `QuickLinkCard` with the title "NHS Dentists" and the Feather `smile` icon; `router.push("/nhs-dentists")` opens it. Put it after Medical Centres.

### New `app/types/nhsDentists.ts`
The same `NhsDentist` and response types, in the pattern of `app/types/binCollections.ts`.

### New `app/nhs-dentists.tsx`
Layout copied from `app/medical-centres.tsx`: `BackHeader`, then a ScrollView with padding 16 and gap 16.

- **Fetching** follows `LocalFuelSection.tsx:33-62`: a `useEffect` with an `isMounted` guard and `EXPO_PUBLIC_BACKEND_URL`.
  - A 503 shows "Dentist list loading, try again shortly".
  - Loading shows an `ActivityIndicator`.
- **Heading** "NHS Dentists", with the subtitle "NHS dental practices within 8 miles of Stockton Heath".
- **Caveat card**, in the amber info style of the medical-centre 111 footer (`#FEF3C7`, `information-circle`). It says:
  - Practices update this themselves, so it can be out of date. Phone before you go, and ask about waiting lists.
  - Any NHS dentist can offer urgent treatment. If you need urgent care, call 111.
  - It links to the NHS urgent dental care page.
- **Filter chips**: All / Adults / Children, each showing a count.
  - The state is local and not persisted.
  - The list is sorted by distance.
- **Practice cards**, one per practice, using a new `components/DentistCard.tsx`. The card uses `globalStyles.card` + `cardWhite` and shows:
  - The name in bold, with the distance on the right ("1.3 miles").
  - The address, muted.
  - A status pill built on `globalStyles.statusBadge`:

    | Status | Pill text | Colour |
    |---|---|---|
    | accepting | "Taking new NHS patients" | green |
    | not_accepting | "Not taking new NHS patients" | neutral |
    | not_confirmed | "Not confirmed" | amber |
    | referral_only | "Referral only" | neutral |

  - For accepting practices, the list of categories: Adults 18+, Children under 18, Adults entitled to free care.
  - "Last confirmed by the practice: 7 Sep 2026". Show it in amber, adding "may be out of date", when it is more than 90 days old. NHS rules require practices to confirm quarterly. Omit the line when the date is null.
  - Action rows in the medical-centre contact-card style:
    - "Call {phone}", which opens `tel:`.
    - "View on the NHS website", which opens `nhsUrl`.
- **Footer**
  - `SourceNote` with the label: "Information from the NHS website, licensed under the Open Government Licence v3.0. Checked daily, last checked {fetchedAt}. Source:". It uses `NHS_FIND_A_DENTIST_URL`. The date shown makes it an "as at" date.
  - A primary `Button`, "Search on the NHS website", which opens `NHS_FIND_A_DENTIST_RESULTS_URL`.

### `utils/dataSources.ts`
All of these URLs were checked and return 200.
- Add **live** URL constants:
  - `NHS_FIND_A_DENTIST_URL = "https://www.nhs.uk/service-search/find-a-dentist"`
  - `NHS_FIND_A_DENTIST_RESULTS_URL`: the results URL above.
  - `NHS_URGENT_DENTAL_URL = "https://www.nhs.uk/nhs-services/dentists/how-to-find-an-nhs-dentist-in-an-emergency/"`
  - `NHS_FIND_DENTIST_HELP_URL = "https://www.nhs.uk/nhs-services/dentists/how-to-find-an-nhs-dentist/"`
- Add a `DATA_SOURCES` entry `{ icon: "smile", name: "NHS website - Find a dentist", detail: "Which nearby dental practices are taking on new NHS patients, checked daily", url: NHS_FIND_A_DENTIST_URL, government: true, group: "live" }`. About picks it up automatically.
- Leave the existing manual "NHS" entry alone.

### `app/help.tsx`
Add a FAQ entry: "A dentist in the app says it's taking NHS patients, but it told me it isn't". The answer explains:
- The status is whatever the practice last told the NHS, and practices must confirm it every 90 days.
- Phone first, and ask about waiting lists.
- For urgent care, call 111.

Link it to `NHS_FIND_DENTIST_HELP_URL`.

### `PROJECT_CONTEXT.md`
Update:
- The Services tab description.
- The route table (`GET /nhs-dentists`).
- Background Jobs (the daily scrape and its crawl delay).
- The external APIs row.
- A short "nhs.uk scraping" note listing the element IDs the parser depends on, the sanity check, the check script, and the OGL and no-branding rules.

## Out of scope
Push alerts; any postcode other than Stockton Heath; the Service Search API. Moving to the API later would be a change to `syncNhsDentists` alone, because the app only sees `NhsDentist`.

## Verification
1. **Parser against live data.**
   - Run `cd backend && npm install && npx tsx scripts/check-nhs-dentists.ts`.
   - Expect about 50 rows up to 8 miles with sensible statuses.
   - Check 3 or 4 practices by hand against nhs.uk. Useful ones: Walton Road (children only), Stockton Heath Dental (all three), Latchford (not accepting), AMK Orthodontics (not confirmed), Halton Road (referral only).
2. **Failure path.**
   - Feed `parseResults` an empty page and a page with no `item_id_` elements. Confirm the sync logs an error and the previous cache survives.
3. **Backend running locally.**
   - Run `npm run dev` and `curl localhost:3001/nhs-dentists`.
   - Expect 503 until the first fetch finishes, then the list.
   - After about 5 minutes, `lastConfirmed` dates should be filled in.
4. **Build.**
   - Backend `npm run build` must pass tsc, since the Dockerfile runs it on a 512 MB box.
   - At the repo root, `npm run lint` and `npx tsc --noEmit`.
5. **App.**
   - Run `npx expo start` with `EXPO_PUBLIC_BACKEND_URL` pointed at the local backend.
   - Walk through Services → NHS Dentists. Check the filters and counts, each status pill, the Call and NHS links, the SourceNote link, and the loading and 503 states.
   - Check About lists the new source and Help shows the new FAQ.
6. **Ship.**
   - `npm run deploy:backend` first. The app screen would show an error until the route exists.
   - Then `npm run ui-update`: the change is JS only, so an over-the-air update carries it.
