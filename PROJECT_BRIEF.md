# Stockton Heath App — Full Project Brief

> Paste this into a new Claude Project as knowledge/instructions. It covers both
> repos, the functional behaviour of the app, the technical architecture, the
> infrastructure, and the known rough edges.

---

## 1. What this project is

**Stockton Heath** is a free community utility app for **Stockton Heath**, a village
suburb of Warrington in Cheshire, UK. It pulls the local information residents
actually need — weather, bin collections, fuel prices, swing bridge closures, and
local amenity info — into one place.

It is a **personal side project** built and maintained by one person (Matt Brierley).
Public contact address: `stocktonheathapp@gmail.com`.

### Release status

| Platform | Status |
| --- | --- |
| **iOS** | **Live on the App Store.** TestFlight used for pre-release builds. |
| **Android** | **Built and configured, pending publication to Google Play.** |
| **Web** | No web version of the app. (There is a separate support website — see §9.) |

### The two repositories

| Repo | Contents |
| --- | --- |
| `mfbrierley/stockton-heath` | The Expo/React Native mobile app **and** its Node/Express backend (in the `backend/` subfolder). Default branch `main`. |
| `mfbrierley/stockton-heath-support` | The public support & contact website plus the privacy policy. Vite + React static site on Vercel. Default branch `main`. |

---

## 2. Repository layout (`mfbrierley/stockton-heath`)

```
/                                   # Expo React Native app (frontend)
  app/                              # Expo Router — file-based routing
    _layout.tsx                     # Root layout: fonts, splash, notifications, welcome prompt
    (tabs)/
      _layout.tsx                   # Bottom tab bar config
      index.tsx                     # Home tab
      services.tsx                  # Services tab (bins + local places)
      bridge.tsx                    # Bridge tab (swing bridge alerts)
    about.tsx                       # About + data sources + version
    help.tsx                        # FAQs
    change-name.tsx                 # Edit the stored first name
    medical-centres.tsx             # Listing page
    stockton-heath-medical-centre.tsx
    latchford-medical-centre.tsx
    stretton-medical-centre.tsx
    broomfields-leisure-centre.tsx
    post-office.tsx
    recycling-centre.tsx            # Lymm Road (Thelwall)
    woolston-recycling-centre.tsx
    styles/
      theme.ts                      # Design tokens (colours, fonts, sizes)
      globalStyles.ts               # Shared StyleSheet
    types/
      binCollections.ts             # Warrington bin API types
  components/                       # 22 shared UI components / feature sections
  hooks/                            # usePushNotifications, useUserName, useRecyclingCentreHours
  utils/dateUtils.ts
  assets/images/                    # Photos, icons, bin SVGs, sponsor logo
  app.json  eas.json  metro.config.js  tsconfig.json  eslint.config.js
  declarations.d.ts                 # Makes `import Foo from "./foo.svg"` typed
  PROJECT_CONTEXT.md                # Existing context doc (see §11 — partly stale)
  .github/copilot-instructions.md   # Existing AI instructions (see §11 — partly stale)

backend/                            # Node.js / Express API server
  src/index.ts                      # ~830 lines: the entire server, routes and jobs
  prisma/schema.prisma              # Prisma schema (SQLite dialect, Turso/libSQL)
  prisma/migrations/                # 4 migrations
  prisma.config.ts
  Dockerfile                        # node:22-alpine
```

There is **no monorepo tooling** — the backend is simply a nested npm project with its
own `package.json`, `tsconfig.json` and `Dockerfile`. The root `package.json` carries a
`deploy:backend` script as a convenience.

---

## 3. Mobile app — technical

### Stack

| Concern | Choice |
| --- | --- |
| Framework | Expo SDK **54**, React Native **0.81.5**, React **19.1.0** |
| Language | TypeScript, `strict: true`, extends `expo/tsconfig.base` |
| Routing | **Expo Router 6** (file-based), `typedRoutes` experiment on |
| Architecture | New Architecture enabled (`newArchEnabled: true`), React Compiler experiment on |
| State | React hooks + one Context (`UserNameProvider`). No Redux/Zustand/React Query. |
| Persistence | `@react-native-async-storage/async-storage` |
| Styling | React Native `StyleSheet` + tokens from `app/styles/theme.ts` |
| Fonts | `@expo-google-fonts` — NotoSerif (headings), Plus Jakarta Sans (body) |
| Icons | `@expo/vector-icons` — **Feather is the default choice**; MaterialCommunityIcons/Ionicons where Feather lacks a glyph |
| SVG | `react-native-svg` + `react-native-svg-transformer` (configured in `metro.config.js`) |
| Linting | `eslint-config-expo` flat config |
| Path alias | `@/*` → repo root |

### `app.json` key values

```
name              Stockton Heath
slug              stockton-heath
version           1.0.2
scheme            stocktonheath
icon              ./assets/images/sh-icon.png
orientation       portrait
userInterfaceStyle automatic
iOS bundleId      com.mattbrierley1.stocktonheath   (supportsTablet: true)
Android package   com.mattbrierley1.stocktonheath   (edge-to-edge on, predictive back off)
EAS projectId     99721d3f-5cda-481a-bf9d-f4a170ea4c95
EAS owner         mattbrierley1
runtimeVersion    policy "appVersion"
updates URL       https://u.expo.dev/99721d3f-5cda-481a-bf9d-f4a170ea4c95
plugins           expo-router, expo-notifications, expo-splash-screen
ITSAppUsesNonExemptEncryption: false
```

Because `runtimeVersion` follows `appVersion`, an **OTA update only reaches builds
carrying the same `version` string**. Bumping `version` in `app.json` cuts off OTA
delivery to older installs.

### Root layout behaviours (`app/_layout.tsx`) — important and non-obvious

1. **Font scaling is hard-disabled app-wide.** `enforceNoFontScaling()` monkey-patches
   the `render` method of RN's `Text` and `TextInput` to force
   `allowFontScaling: false`. This is deliberate and **cannot be overridden by a
   component-level prop** — it was chosen over `defaultProps` (deprecated in React).
   The app therefore ignores iOS Dynamic Type / "Larger Text". Don't "fix" this
   without a conversation.
2. **Splash sequence**: native splash (solid `#1B4332`) → hidden once fonts load →
   custom `AppSplashScreen` overlay for **3000 ms**. There is a live
   `// TODO: revert to 4000` on that timer.
3. **Welcome prompt**: on first launch, once the splash clears and storage has loaded,
   `WelcomeNamePrompt` asks for a first name. Skippable. Writes `welcomeCompleted`.
4. **Notification tap handling**: handles both warm taps (listener) and cold-start taps
   (`getLastNotificationResponseAsync`), **deduped by notification identifier** because
   a cold-start tap fires through both paths. From the payload it computes
   `expiresAt = sentAt + (closureMinutes + 15) minutes`, writes an
   `activeBridgeClosure` record to AsyncStorage if that window hasn't already passed,
   then routes to `/(tabs)/bridge`.
5. Notification handler shows banner + list + sound, **no badge**.

### Navigation shape

- Root `Stack`, all headers hidden.
- `(tabs)` — three tabs, active tint `#2D6A4F`, white tab bar:
  - **Home** (`home` icon) — no header, uses its own parallax hero.
  - **Services** (`trash-2` icon) — custom "StocktonHeath" serif header.
  - **Bridge** (`bridge` icon, MaterialCommunityIcons) — same custom header.
- Everything else is a pushed stack screen with a shared `BackHeader` component.

### AsyncStorage keys (the complete set)

| Key | Written by | Purpose |
| --- | --- | --- |
| `userFirstName` | `useUserName` | Greeting personalisation. Max 11 chars, trimmed. |
| `welcomeCompleted` | `useUserName` | Suppresses the first-launch name prompt. |
| `userAddress` | `services.tsx` | `{ address, uprn }` chosen in the bin lookup. |
| `binCollections_{uprn}_{YYYY-MM-DD}` | `services.tsx` | Per-day cache of the council schedule. Key rotates daily, so stale data self-expires. |
| `bridgeNotificationsEnabled` | `bridge.tsx` | `"true"`/`"false"` opt-in flag. |
| `binNotificationsEnabled` | `BinNotificationSection` | `"true"`/`"false"` opt-in flag. |
| `activeBridgeClosure` | `_layout.tsx` | `{ firstBridge, expiresAt }` — drives the live closure banner. |

### Hooks

- **`hooks/usePushNotifications.ts`** — `registerForPushNotifications()`. Creates the
  Android `default` channel at MAX importance, requests permission if not already
  granted, resolves the EAS `projectId` from `expoConfig.extra.eas.projectId` (falling
  back to `easConfig.projectId`), then fetches the Expo push token. Returns
  `{ granted, token }`. Distinguishes **permission denied** (`granted: false`) from a
  **transient failure** (`granted: true, token: null`) so callers can show the right UI.
- **`hooks/useUserName.tsx`** — Context provider over AsyncStorage. Exports
  `USER_FIRST_NAME_KEY`, `WELCOME_COMPLETED_KEY`, `MAX_FIRST_NAME_LENGTH = 11`.
  Throws if `useUserName()` is called outside the provider.
- **`hooks/useRecyclingCentreHours.ts`** — two hooks, one per recycling centre.
  Both compute UK-local status via `Intl.DateTimeFormat` with `timeZone: "Europe/London"`,
  fetch `https://www.gov.uk/bank-holidays.json` for England & Wales, treat 25 Dec,
  26 Dec and 1 Jan as hard closures, tick every 60 s, and expose a 30-minute
  "closing soon" / "opening soon" threshold.

  | Centre | Weekday | Weekend / bank holiday |
  | --- | --- | --- |
  | Lymm Road (Thelwall) | 10:00–16:00 | 10:00–18:00 **Apr–Sep only**, else 10:00–16:00 |
  | Woolston | 10:00–16:00 | 08:00–18:00 all year |

  Status values: `open` / `closing-soon` / `opening-soon` / `closed`, each with a
  label, colour, background and icon in `STATUS_CONFIG`.

### Design system (`app/styles/theme.ts`)

```
primary    #1B4332   (dark green — also the splash/adaptive-icon background)
secondary  #6DA688
tertiary   #2D6A4F   (active tab tint)

neutral100 #FCF6EF  ← app "paper" background
neutral200 #F5EBE0  ← screen background
neutral300…neutral1200  warm brown-grey ramp down to #1C0F07
neutralDark #d1b084

green100 #EAF2EE … green1000 #1B4332 … green1200 #0A1A14

statusGreen #16A34A   statusAmber #D97706   statusRed #DC2626

fonts      heading: NotoSerif / NotoSerifBold
           body:    PlusJakartaSans / PlusJakartaSansBold
fontSizes  heading 24, largeBody 18, body 16
```

**Convention:** reach for `app/styles/globalStyles.ts` (card, cardWhite, cardList,
cardListHeader, tiles, heading/body variants, divider, back button) before writing a
one-off `StyleSheet`. Reference fonts as `theme.fonts.*`, never raw family strings.

---

## 4. Mobile app — functional walkthrough

### Home tab (`app/(tabs)/index.tsx`)

- **Parallax hero** — `stockton-heath-photo.jpg` at 250 px, translating up and fading
  out over the first 250 px of scroll (native driver).
- **GreetingCard** — personalised with the stored first name plus current conditions.
- **WeatherSection** — **OpenWeather One Call API 3.0**, called **directly from the
  client**, hardcoded to `lat 53.3705, lon -2.5811` (Stockton Heath), `units=metric`.
  Wind converted m/s → mph (× 2.237).
- **LocalFuelSection** — `GET {backend}/fuel-prices`. Shows three local stations.
  Handles `503` ("Fuel prices loading, try again shortly") distinctly.
- **SponsorCard** — the paid placement (see §7).
- **BinReminderCard** → Services tab. **BridgeAlertsCard** → Bridge tab.
- Quick links: **About this app**, **Help**, **Change my name**.

### Services tab (`app/(tabs)/services.tsx`)

The bin lookup flow, which is the app's most-used feature:

1. User types a postcode. It is lowercased and all whitespace stripped, then
   `GET https://www.warrington.gov.uk/bin-collections/get-addresses/uprn/{postcode}`
   with a spoofed `Referer: https://www.warrington.gov.uk/` header.
2. The response is a list of `{ address: uprn }` entries. User picks theirs.
3. Selection is persisted to `userAddress`. On subsequent launches it is restored and
   the cached schedule shows immediately.
4. Schedule comes from
   `GET https://www.warrington.gov.uk/bin-collections/get-jobs/{uprn}` (same Referer),
   cached under a date-stamped key so it refetches once per day.
5. `WasteCollectionSection` maps the council's job names onto bin SVGs by exact match:

   | Council job name | Displayed as |
   | --- | --- |
   | `empty bin blue 240l` | Blue bin |
   | `empty bin green 240l` | Green bin |
   | `empty bin black 240l` | Black bin |
   | `empty bin food waste caddy` | Food waste bin |

6. **BinNotificationSection** appears only once an address is set. Subscribing posts
   `{ token, uprn }` to the backend and flips `binNotificationsEnabled`. It
   **self-heals**: on mount, if the flag is set and permission is still granted, it
   silently re-upserts in case the Expo token rotated.

Below that: a sponsor badge, the recycling centre section, and **Local Services** links
to Broomfields Leisure Centre, the Post Office, and Medical Centres.

### Bridge tab (`app/(tabs)/bridge.tsx`)

Covers the **Latchford swing bridges** over the Manchester Ship Canal — Knutsford Road,
London Road and Chester Road — which close to road traffic when a ship passes.

- **BridgeAlertSection** — latest alert from `GET {backend}/bridge-alerts/latest`.
  Parses Twitter's `"Sun Apr 19 18:19:05 +0000 2026"` date format by hand into ISO.
  Renders "Today" / "Yesterday" / `19 Apr 2026`. If an unexpired `activeBridgeClosure`
  is in storage, shows a live closure banner naming the first bridge to close.
- **Subscribe / active states** — opting in registers the Expo push token against
  `POST /bridge-subscriptions`. The active-state card explains users get ~20 minutes'
  warning. Re-checks permission on every `AppState` → `active` transition and
  self-heals the token. If permission was hard-denied, the button becomes
  **Open Settings** (`Linking.openSettings()`).
- **Two `BridgeClosuresChart` instances** — "This week's activity" (7 day) and
  "This month's activity" (30 day). Both fetch `GET {backend}/bridge-alerts` and bucket
  by day. The chart is **hand-rolled SVG** (`react-native-svg`), no charting library.

### Other screens

- **About** — mission statement, contact email, the list of data sources (OpenWeather,
  Gov.uk Fuel Finder, twitterapi.io / @trafficwarr, Warrington Borough Council), and
  the app version read live from `Constants.expoConfig?.version`.
- **Help** — six FAQs: bin collection lookup, bridge alerts, bin reminders, fuel price
  freshness, bridge alert freshness, and missing addresses in the lookup.
- **Static info screens** — Recycling Centre (Lymm Road), Woolston Recycling Centre,
  Broomfields Leisure Centre, Post Office, and three medical centres (Stockton Heath,
  Latchford, Stretton) with contact details, opening hours and links to eConsult /
  appointments / prescriptions / test results. All content is hardcoded in the TSX.

---

## 5. Backend — technical

**One file does everything:** `backend/src/index.ts` (~830 lines) contains the Express
app, all routes, the push-notification plumbing, and all three background jobs.

| Concern | Choice |
| --- | --- |
| Runtime | Node **22** (alpine in Docker) |
| Framework | **Express 5** |
| Language | TypeScript → `tsc` → `dist/`. `module: CommonJS`, `moduleResolution: node10`, target ES2022, strict |
| ORM | **Prisma 7** with `@prisma/adapter-libsql` |
| Database | **Turso** (hosted libSQL/SQLite) — `stockton-heath-mattbrierley.aws-eu-west-1.turso.io` |
| Port | 3001 |
| Dev | `npm run dev` → `tsx watch src/index.ts` |
| Build | `npm run build` → `prisma generate && tsc` |

The Prisma client is generated to `src/generated/prisma` (gitignored, regenerated at
build time). `setDefaultResultOrder("ipv4first")` is called at the top of the file to
work around DNS resolution issues on the droplet.

### Data model (`backend/prisma/schema.prisma`)

```prisma
model BridgeAlert        { id Int @id @default(autoincrement())
                           tweetId String @unique
                           tweetText String
                           postedAt String
                           detectedAt String }

model BridgeSubscription { id Int @id @default(autoincrement())
                           token String @unique }

model BinSubscription    { id Int @id @default(autoincrement())
                           token String @unique
                           uprn String }

model AppMeta            { key String @id
                           value String }
```

`AppMeta` currently holds one row: `lastBinNotificationDate`.

**Migrations** (`backend/prisma/migrations/`):
`20260415203308_init` → `20260420000000_add_push_tokens` →
`20260601000000_replace_push_token_with_subscriptions` → `20260701000000_add_app_meta`.
The original single `PushToken` table was split into the two subscription tables.

### API surface

🔒 = admin-only (requires `x-admin-token` header).

| Method | Route | Body / params | Description |
| --- | --- | --- | --- |
| GET | `/` | — | Returns the string `Backend is running` |
| GET | `/health` | — | `{ ok: true }` |
| GET | `/test-key` 🔒 | — | `{ hasKey: boolean }` — is the twitterapi.io key configured |
| GET | `/bridge-alerts` | — | All alerts, newest first (used by the charts) |
| GET | `/bridge-alerts/latest` | — | `{ latestAlert }` |
| GET | `/bridge-alerts/check/:userName` 🔒 | — | Force an immediate Twitter poll |
| POST | `/bridge-alerts/test-notification` 🔒 | — | Sends a fake alert push to **every** bridge subscriber |
| POST | `/bridge-subscriptions` | `{ token }` | Upsert a bridge push subscription |
| DELETE | `/bridge-subscriptions` | `{ token }` | Remove it |
| POST | `/bin-subscriptions` | `{ token, uprn }` | Upsert a bin reminder subscription |
| DELETE | `/bin-subscriptions` | `{ token }` | Remove it |
| GET | `/fuel-prices` | — | `{ data, fetchedAt }`, or `503` before the first sync completes |

### Admin auth (`requireAdmin` middleware)

Guards only the routes that **cost money** (a metered twitterapi.io call) or **reach
every user's device** (push fan-out). Implementation notes:

- Reads the `x-admin-token` request header, compares against the `ADMIN_TOKEN` env var.
- **SHA-256 hashes both sides before `timingSafeEqual`** — this guarantees equal-length
  buffers and stops the comparison leaking the expected token's length.
- **Fails closed:** if `ADMIN_TOKEN` is unset the routes return `503`, not `200`.
  Mismatch returns `401`.
- Generate a token with `openssl rand -hex 32`.

Every other route is intentionally public — they are read-only or accept only an Expo
push token. There is **no rate limiting**, and `cors` is a dependency but is never
wired up (unnecessary while the only client is the native app).

### Background jobs

All three are plain `setInterval` calls at the bottom of `index.ts`. **There is no cron
or job runner** — a process restart resets the timers.

**1. Bridge alert polling — every 10 minutes (and once on boot)**

- Skips entirely outside **06:00–22:00 Europe/London**.
- Queries twitterapi.io advanced search:
  `"Swingbridge Alert" from:trafficwarr`, `queryType=Latest`.
- If a previous alert exists, appends `since_time:{unix}` derived from the last stored
  `postedAt` + 1 second — so it only ever pulls genuinely new tweets.
- Iterates results **oldest-first**, dedupes on `tweetId`, saves each new one, and
  fires a push for it.

**2. Fuel price sync — every 30 minutes (and once on boot)**

- OAuth client-credentials POST to the Gov.uk Fuel Finder token endpoint; the token is
  cached in memory and refreshed 60 s before expiry.
- Pages through `?batch-number=N` until all three local stations are found or a batch
  comes back empty.
- Filters to fuel types **`E10`** and **`B7_STANDARD`** only.
- **On failure it retains the previous cache** rather than blanking the section.
- Stations are matched on opaque `node_id` SHA hashes hardcoded in the file:

  | node_id (truncated) | Display name | Location |
  | --- | --- | --- |
  | `78e106b1…` | ASDA Causeway | Wilderspool Causeway |
  | `751b9cfb…` | ESSO Latchford | Knutsford Road |
  | `0ee49af1…` | Morrisons | Stockton Heath |

**3. Bin reminders — checked every 60 seconds, fires at 18:00 UK**

- Returns immediately unless the UK hour is exactly `18`.
- Deduped per calendar day via `AppMeta.lastBinNotificationDate`. **The date is written
  before any sends happen**, so a crash or redeploy mid-fan-out cannot double-send.
  Falls back to an in-memory variable if the `AppMeta` table isn't available.
- Groups subscriptions by UPRN so each address hits the council API once, not once per
  device.
- Filters the schedule for tomorrow's UK date; if nothing is due, sends nothing.
- Builds a friendly list ("blue bin, green bin and food waste bin") and pushes
  title `🚛 Bin collection tomorrow`, body `Put out your {bins} tonight`.

### Push notification delivery

- Endpoint `https://exp.host/--/api/v2/push/send`, sent in **batches of 100**
  (Expo's per-request limit).
- Response tickets are inspected; any token Expo reports as `DeviceNotRegistered`
  (app uninstalled) is **automatically pruned** from the relevant subscription table.
- **Bridge push** — title `Stockton Heath Bridge Alert`. `parseBridgeAlert()` extracts
  the closure duration with the regex `/in (?:about|approximately|around)?\s*(\d+)\s*minutes?/i`
  and picks the **first bridge mentioned in the tweet text**, checked against the
  ordered list Knutsford Road → London Road → Chester Road (sorted by position in the
  string, not by list order). Body:
  `⚠️ 🚢 Swing Bridges closing in around 20 mins - Knutsford Road first.`
  Data payload: `{ tweetId, firstBridge, closureMinutes, sentAt }` — consumed by the
  root layout's tap handler.
- **Bin push** — plain title/body, no data payload.

---

## 6. Infrastructure, deployment & environment

### Backend hosting

- **DigitalOcean Droplet** (Ubuntu). SSH alias `stockton-heath`.
- Repo cloned at **`/opt/stockton-heath`** on the droplet.
- Runs as a **plain `docker run` container** (no compose, no orchestration) named
  `stockton-heath-backend`, `--restart unless-stopped`, port `3001:3001`,
  `--env-file ./backend/.env`.
- Public domain **`https://stocktonheath.duckdns.org`** via DuckDNS dynamic DNS.
- **No CI/CD. All deploys are manual.**

From the repo root, `npm run deploy:backend` does the whole thing over SSH:

```bash
ssh stockton-heath 'cd /opt/stockton-heath && git pull \
  && docker build -t stockton-heath-backend ./backend \
  && docker stop stockton-heath-backend && docker rm stockton-heath-backend \
  && docker run -d --name stockton-heath-backend --restart unless-stopped \
     -p 3001:3001 --env-file ./backend/.env stockton-heath-backend'
```

Note this pulls whatever is on the droplet's checked-out branch — **push first**.

### App distribution (EAS)

Three build profiles in `eas.json`, each with a matching update channel:
`development` (dev client, internal), `preview` (internal), `production`
(`autoIncrement: true`). `cli.appVersionSource` is `remote`, so EAS owns the build
number.

```bash
npm run testflight   # eas build -p ios --profile production && eas submit -p ios --latest
npm run ui-update    # eas update --branch production --message "UI update"
```

- `ui-update` ships a **JS-only OTA update** — no App Store review — but only reaches
  installs whose `version` matches (see the `runtimeVersion` note in §3).
- Anything touching native code or config requires a full build + submit.
- **Android:** the EAS profiles are platform-agnostic, so
  `eas build --platform android --profile production` works today with no config
  change. `submit.production` is currently empty `{}`, so a Google Play submission
  needs a service-account key configured there (or `eas submit` will prompt).
- Push is delivered through the **Expo Push Notification service**, which abstracts
  APNs (and FCM once Android ships).

### Environment variables

**Frontend** — both are `EXPO_PUBLIC_*`, meaning they are **inlined into the client
bundle at build time and are readable by anyone with the app**. They are not secrets.
They are committed into all three `eas.json` profiles so EAS builds need no local file;
a local `.env` with the same two keys is needed for `expo start`.

| Variable | Value / purpose |
| --- | --- |
| `EXPO_PUBLIC_OPENWEATHER_API_KEY` | OpenWeather One Call 3.0 key |
| `EXPO_PUBLIC_BACKEND_URL` | `https://stocktonheath.duckdns.org` |

**Backend** (`backend/.env`, never committed):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Turso libSQL URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `TWITTERAPI_IO_API_KEY` | twitterapi.io key (metered — this one costs money) |
| `ADMIN_TOKEN` | Shared secret for the 🔒 routes. Unset ⇒ those routes 503. |
| `FUEL_FINDER_CLIENT_ID` | Gov.uk Fuel Finder OAuth client ID |
| `FUEL_FINDER_CLIENT_SECRET` | Gov.uk Fuel Finder OAuth client secret |

### External services and APIs

| Service | Used for | Called from | Auth |
| --- | --- | --- | --- |
| OpenWeather One Call 3.0 | Home weather | **Client** | API key in URL |
| Gov.uk Fuel Finder | Local fuel prices | Backend | OAuth client credentials |
| twitterapi.io | Reading `@trafficwarr` tweets | Backend | `x-api-key` header |
| Warrington Borough Council bin API | Address lookup + collection schedule | **Client** *and* backend | None — spoofed `Referer` header |
| gov.uk `bank-holidays.json` | Recycling centre opening status | **Client** | None |
| Expo Push Notification service | All push | Backend | None (token-addressed) |
| Turso | Database | Backend | Auth token |
| Web3Forms | Support site contact form | **Support site client** | Public access key |

---

## 7. Monetisation

The app carries **a single hardcoded sponsor**, currently **Rowswood Timber** (a
landscaping/timber supplier on Hatton Lane, Hatton, Warrington —
`rowswoodtimber.com`).

- `components/SponsorCard.tsx` — a full "About our sponsor" card on the **Home** tab
  with logo, blurb, location and outbound link.
- `components/SponsorBadge.tsx` — a compact "SPONSORED BY" strip on the **Services**
  and **Bridge** tabs.

Both import the logo directly (`assets/images/Rowswood-Timber-Logo.svg`). **Changing
sponsor is a code change.** Text/style-only changes can ship via `npm run ui-update`
(OTA, no review); swapping the logo asset needs a full build.

There is no ad network, no IAP, no subscription, and no analytics.

---

## 8. Conventions to follow

- TypeScript strict everywhere.
- Prefer `globalStyles` over new one-off `StyleSheet` entries.
- Use `theme.fonts.*` / `theme.colors.*`, never raw hex or font-family strings.
- Feather icons first.
- `void someAsync()` for deliberate fire-and-forget calls.
- All frontend backend calls go through `process.env.EXPO_PUBLIC_BACKEND_URL`, guarded
  for the undefined case.
- Push subscription components **self-heal**: re-upsert the token on mount when the
  local opt-in flag is set and permission is still granted, because Expo tokens rotate.
- Anything time-related is computed in `Europe/London` via `Intl.DateTimeFormat`,
  never with raw local `Date` methods.
- **Shell gotcha:** quote paths containing `(tabs)` — e.g. `cat "app/(tabs)/index.tsx"` —
  or zsh will try to glob them.

---

## 9. The support website (`mfbrierley/stockton-heath-support`)

A deliberately tiny static site that exists to **satisfy App Store Connect's mandatory
public support URL requirement**, and to host the privacy policy.

| Concern | Choice |
| --- | --- |
| Build | **Vite 8** + `@vitejs/plugin-react` |
| Framework | React **19.2**, TypeScript ~6.0 |
| Styling | **Plain CSS** (`src/App.css`, `src/index.css`) — no UI framework |
| Linting | **oxlint** (not ESLint) |
| Hosting | **Vercel**, Vite preset auto-detected, **no environment variables** |
| Fonts | Noto Serif + Plus Jakarta Sans from Google Fonts — matches the app |

### Structure

```
index.html            # Title "Stockton Heath — Support & Contact", Google Fonts preconnect
src/main.tsx          # React root
src/App.tsx           # The entire support page + contact form
src/App.css
public/privacy.html   # Standalone hand-written privacy policy (no React)
public/favicon.svg
.claude/launch.json   # Dev server config, port 5173
```

### Contact form

Submits **directly from the browser to Web3Forms** (`https://api.web3forms.com/submit`)
— there is no backend, no API route, no serverless function. The access key
`fadc60fe-91c3-4431-8114-b11bafaa9cc3` is hardcoded client-side (that is how Web3Forms
is designed to work). Submissions are emailed to the inbox tied to that key.

- Fields: **name, email, subject, message** — all required.
- A hidden `botcheck` honeypot checkbox provides spam protection. **Do not remove it.**
- Status machine: `idle → loading → success | error`. On success the form is reset and
  replaced by a thank-you message; on error it suggests emailing directly.
- Fallback address shown below the form: `stocktonheathapp@gmail.com`.
- Footer links to `/privacy.html`.

Commands: `npm run dev` (port 5173), `npm run build` (`tsc -b && vite build` → `dist/`),
`npm run lint`, `npm run preview`.

### Privacy policy (`public/privacy.html`, last updated 1 July 2026)

Self-contained HTML with inlined CSS mirroring the app's palette. Substance:

- **Collected:** the push notification token (only if notifications are enabled);
  support form submissions (name, email, subject, message) via Web3Forms.
- **Stored only on device, never transmitted:** first name and address. The policy is
  explicit that the developer has no access to these.
- **Not used at all:** analytics, advertising, and crash-reporting SDKs — none are in
  the app.
- Third parties named: **Apple Push Notification service** and **Web3Forms**.
- Retention: tokens kept while notifications remain enabled; removed on disable,
  uninstall, or request.
- Children: general audience, not directed at under-13s.
- Rights: UK/EU GDPR access/correction/deletion/objection, with a right to complain to
  the **ICO**.

**Keep this accurate.** If the app ever adds analytics, crash reporting, or a new
third-party processor, this page and the App Store privacy nutrition labels both need
updating.

---

## 10. Local context (useful when writing copy or features)

Stockton Heath is a village suburb of Warrington, Cheshire, England. Landmarks the app
references:

- **Latchford swing bridges** — Knutsford Road, London Road and Chester Road cross the
  **Manchester Ship Canal** and swing open for shipping, closing to road traffic and
  causing significant local disruption. This is what the Bridge tab exists for, and
  **@trafficwarr** on Twitter/X is the source of truth for closures.
- **Broomfields Leisure Centre** — council-run gym, pool, classes, football pitches,
  venue hire.
- **Medical centres** — Stockton Heath, Latchford and Stretton surgeries.
- **Stockton Heath Post Office** — London Road; banking, parcels, bills, passport
  Check & Send.
- **Household Waste Recycling Centres** — Lymm Road (Thelwall) and Woolston.
- **Petrol stations** — ASDA Wilderspool Causeway, ESSO Latchford (Knutsford Road),
  Morrisons Stockton Heath.
- Bin colours in Warrington: **blue** (paper/card), **green** (garden), **black**
  (general), plus a **food waste caddy**.

---

## 11. Known issues, rough edges and gotchas

Worth knowing before making changes. None of these are currently breaking the app.

### Documentation drift

1. **`.github/copilot-instructions.md` is partly stale.** It documents a `PushToken`
   model and a `POST /push-tokens` route that **no longer exist** — they were replaced
   by `BridgeSubscription` / `BinSubscription` and the `/bridge-subscriptions` +
   `/bin-subscriptions` routes. It also omits `ADMIN_TOKEN` and the admin-gated routes
   entirely.
2. **`PROJECT_CONTEXT.md` is accurate on the backend but stale on Android** — it states
   iOS is the only shipped platform and that there is no Android path, written before
   the Play Store submission.
3. **The root `README.md` is untouched `create-expo-app` boilerplate.** It documents a
   `npm run reset-project` script pointing at `scripts/reset-project.js` — **a file that
   does not exist in this repo**. Running it fails.

### Repo hygiene

4. **`backend/` contains a large amount of stray Expo/React Native scaffolding that has
   nothing to do with the API server**: a complete `backend/ios/` Xcode project (named
   "backend"), plus `backend/app.json`, `backend/eas.json`, `backend/fly.toml` (a
   leftover from before the Fly.io → DigitalOcean migration), and a committed
   `backend/dev.db` SQLite file. `backend/package.json` also carries `expo`, `react`,
   `react-native` and `@flydotio/litestream` dependencies and `android`/`ios` scripts the
   server never uses — these are installed by `npm ci` inside the Docker build and bloat
   the image. Safe to remove, but do it deliberately.
5. **No tests in either repo.** No test runner is configured.
6. **No CI.** `.github/` contains only `copilot-instructions.md` — no workflows.

### Security / secrets

7. **The OpenWeather API key is committed in plaintext in `eas.json`** across all three
   profiles. Because it is an `EXPO_PUBLIC_*` var it ends up in the shipped bundle
   anyway, but it is also in git history — rotating it means editing `eas.json` and the
   local `.env`, then rebuilding.
8. **The Web3Forms access key is hardcoded in `src/App.tsx`** on the support site. This
   is by design for Web3Forms, but it is public and can be abused to spam the inbox;
   the honeypot is the only mitigation.
9. **No rate limiting on any public backend route.** `POST /bridge-subscriptions` and
   `POST /bin-subscriptions` will accept arbitrary tokens from anyone.
10. **`cors` is a backend dependency but is never wired up.** Fine today; it would need
    adding if the support site or a web build ever called the API.

### Fragility

11. **The Warrington council bin API is undocumented and unofficial**, called with a
    spoofed `Referer` header, and — critically — called **directly from the client**.
    If the council changes the endpoint, adds CORS restrictions, or blocks the header
    pattern, the bin feature breaks for every installed app and can only be fixed with
    an OTA update or a new build, not a backend deploy.
12. **Fuel station matching depends on opaque `node_id` SHA hashes** hardcoded in
    `backend/src/index.ts`. If Fuel Finder rotates them, the fuel section silently
    returns an empty list with no error.
13. **Bridge alerts depend entirely on one Twitter account** (`@trafficwarr`) continuing
    to post in a parseable format, read through a third-party paid API (twitterapi.io).
    The `parseBridgeAlert` regex and bridge-name matching are brittle to wording changes.
14. **Background jobs are in-process `setInterval`s.** A container restart resets every
    timer. The bin reminder is protected by the `AppMeta` day-key, but bridge polling
    simply resumes from the next interval.
15. **Single point of failure**: one droplet, one container, no health-check-driven
    restart beyond `--restart unless-stopped`, no monitoring or alerting.

### Code-level

16. `app/_layout.tsx:83` — `setTimeout(..., 3000) // TODO: revert to 4000` on the splash.
17. `app/(tabs)/services.tsx` — `binCollections` state is typed `any`.
18. Two nearly identical recycling-centre hooks (`useRecyclingCentreHours` /
    `useWoolstonRecyclingCentreHours`) duplicate the bank-holiday fetch, the 60 s ticker
    and the status computation; only the opening-hours function differs.
19. Font scaling is globally disabled by monkey-patching `Text`/`TextInput` (§3) — an
    accessibility trade-off that is intentional but should be a conscious decision to keep.

### Recent history

The most recent substantive change (merged PR #1) **added the admin authentication
middleware** to the privileged backend endpoints and corrected `PROJECT_CONTEXT.md`.
Before that, work was on home screen cards, the bridge notification UI, medical centre
screens and font-size capping.

---

## 12. Quick command reference

```bash
# ── App repo (mfbrierley/stockton-heath) ──────────────────────────────
npm install
npm start                 # expo start (needs a local .env)
npm run ios               # expo run:ios
npm run android           # expo run:android
npm run lint              # expo lint

npm run testflight        # build + submit iOS production
npm run ui-update         # OTA JS update to the production channel
npm run deploy:backend    # SSH + docker rebuild/restart on the droplet

# Android build (works today with the existing production profile)
eas build --platform android --profile production

# ── Backend (backend/) ────────────────────────────────────────────────
npm run dev               # tsx watch src/index.ts
npm run build             # prisma generate && tsc
npm start                 # node dist/index.js
npx prisma migrate dev    # new migration (needs DATABASE_URL + TURSO_AUTH_TOKEN)

# ── Support site (mfbrierley/stockton-heath-support) ──────────────────
npm install
npm run dev               # vite, port 5173
npm run build             # tsc -b && vite build  → dist/
npm run lint              # oxlint
npm run preview
```
