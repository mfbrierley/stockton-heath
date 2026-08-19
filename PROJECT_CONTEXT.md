# Stockton Heath - Project Context

## What is this?

Stockton Heath is a personal side project - a community utility app for **Stockton Heath**, a village in Warrington, Cheshire, UK. It's built for residents of the area and provides useful local information and services in one place: weather, bin collections, fuel prices, bridge closure alerts, and local amenity info.

The app is **live on the iOS App Store** with active users. There is no web version.

---

## The App (Frontend)

Built with **Expo / React Native** - a cross-platform mobile framework using React and TypeScript. Expo Router handles file-based navigation (similar to Next.js for React Native).

### Screens

#### Home Tab

- Personalised greeting card - the user is asked for their first name on first launch (`WelcomeNamePrompt`), stored locally and editable from the About screen via `/change-name`
- Displays current **weather** for Stockton Heath (lat/lon hardcoded) using the **OpenWeather One Call API**
- Shows live **local fuel prices** for three nearby petrol stations:
  - ASDA (Wilderspool Causeway)
  - ESSO (Latchford / Knutsford Road)
  - Morrisons (Stockton Heath)
- Fuel prices come from the backend, which polls the UK Government's **Fuel Finder API**
- **Sponsor card** - a paid placement for a local business (currently Rowswood Timber). Hardcoded in `components/SponsorCard.tsx`
- Summary cards linking through to bin collections and bridge alerts
- Quick links to the **About** and **Help** screens

#### Services Tab

- **Bin collection lookup**: user enters their postcode, selects their address from a list, and the app fetches their upcoming bin collection schedule from Warrington Borough Council's public API
- Address and bin data is cached locally so it loads instantly on repeat visits
- Users can **subscribe to bin reminders** - a push notification the evening before their collection
- Links to:
  - **Recycling centres** - Lymm Road (Thelwall) and Woolston, each with accepted items, permit items (DIY waste), and opening hours
  - **Broomfields Leisure Centre** - opening hours, list of facilities (gym, pool, classes, football pitches, venue hire)
  - **Medical centres** - a list screen linking to Stockton Heath, Latchford and Stretton surgeries, each with opening hours and links to eConsult, appointments, prescriptions, test results
  - **Stockton Heath Post Office** - opening hours, full list of available services (banking, parcels, bills, passport check & send)

#### Bridge Tab

- Shows the latest **swing bridge closure alert** for the Latchford swing bridge (Warrington)
- Alerts are sourced from the **@trafficwarr** Twitter/X account, which posts "Swingbridge Alert" tweets
- Users can **subscribe to push notifications** to be alerted whenever a new bridge closure is detected
- **Closure history chart** (`BridgeClosuresChart`) - a hand-rolled SVG chart of recent closure frequency
- The backend polls Twitter every 10 minutes (6am-10pm UK time only) and sends Expo push notifications to all subscribed devices when a new alert appears

#### Other Screens

- **About** (`/about`) - app version, credits, and the list of data sources the app depends on
- **Help** (`/help`) - FAQs covering bin lookup, bridge alerts and notifications

### Design

- Colour scheme: dark green (`#1B4332`) as the primary, with warm neutral backgrounds (`#FCF6EF`)
- Fonts: **NotoSerif** for headings, **Plus Jakarta Sans** for body text
- Icons from `@expo/vector-icons` - Feather icon set is preferred
- Consistent design tokens defined in `app/styles/theme.ts`

---

## The Backend

A **Node.js / Express 5** API server written in TypeScript, deployed on a DigitalOcean Droplet.

### What it does

- Serves as a proxy/cache for fuel price data (fetching from the Gov.uk Fuel Finder API every 30 minutes)
- Polls Twitter (via twitterapi.io) for bridge closure tweets and stores them in a database
- Stores Expo push notification tokens and fans out push notifications for bridge closures and bin collection reminders
- Exposes a simple REST API consumed by the mobile app

### API Routes

| Route                                | Description                                             |
| ------------------------------------ | ------------------------------------------------------- |
| `GET /`                              | Health check string                                     |
| `GET /health`                        | JSON `{ ok: true }`                                     |
| `GET /test-key`                      | Reports whether the twitterapi.io key is configured     |
| `GET /bridge-alerts`                 | All stored bridge alerts, newest first                  |
| `GET /bridge-alerts/latest`          | Most recent bridge alert only                           |
| `GET /bridge-alerts/check/:userName` | Manually trigger a poll from a given Twitter username   |
| `POST /bridge-alerts/test-notification` | Sends a fake bridge alert push to every subscriber   |
| `POST /bridge-subscriptions`         | Register an Expo push token for bridge alerts           |
| `DELETE /bridge-subscriptions`       | Unregister a token from bridge alerts                   |
| `POST /bin-subscriptions`            | Register a token + UPRN for bin reminders               |
| `DELETE /bin-subscriptions`          | Unregister a token from bin reminders                   |
| `GET /fuel-prices`                   | Cached fuel prices for local stations                   |

> **No authentication.** The only middleware registered is `express.json()`. Every route above is publicly reachable, including `POST /bridge-alerts/test-notification` (pushes to all devices) and `GET /bridge-alerts/check/:userName` (triggers a metered twitterapi.io call). `cors` is a dependency but is not wired up.

### Database

Uses **Turso** (a hosted libSQL/SQLite service) via **Prisma** ORM. Four tables:

- `BridgeAlert` - each detected bridge closure tweet (tweetId, tweetText, postedAt, detectedAt)
- `BridgeSubscription` - Expo push tokens subscribed to bridge alerts
- `BinSubscription` - Expo push tokens subscribed to bin reminders, each paired with a UPRN
- `AppMeta` - simple key/value store; currently holds `lastBinNotificationDate` for reminder de-duplication

Migrations live in `backend/prisma/migrations/`. Note that the original `PushToken` table was replaced by the two subscription tables in `20260601000000_replace_push_token_with_subscriptions`.

### Background Jobs

All scheduled with `setInterval` in `backend/src/index.ts` - there is no cron or job runner.

- **Bridge polling** (every 10 minutes, 6am-10pm UK time): checks twitterapi.io for new tweets from `@trafficwarr` containing "Swingbridge Alert". If a new one is found, it saves it to the database and pushes to all bridge subscribers via the Expo Push Notification service.
- **Fuel price polling** (every 30 minutes): fetches fresh prices from the Gov.uk Fuel Finder API using OAuth client credentials. Results are cached in memory.
- **Bin reminders** (checked every minute, fires at 18:00 UK time): groups bin subscriptions by UPRN, queries the council API for each, and pushes "Put out your \<bins\> tonight" to anyone with a collection tomorrow. De-duplicated per day via `AppMeta` so a redeploy can't double-send.

Invalid Expo push tokens returned by the push service are pruned from the relevant subscription table automatically.

---

## Infrastructure & Deployment

### Backend

- Hosted on a **DigitalOcean Droplet** (Ubuntu)
- Domain: `https://stocktonheath.duckdns.org` (DuckDNS for dynamic DNS)
- Runs as a plain **Docker container** (`docker run`) on port 3001
- Deployed with `npm run deploy:backend`, which SSHes into the droplet, pulls, rebuilds the image and restarts the container
- No CI/CD pipeline - all deployments are manual

### Frontend (iOS)

- Built and submitted using **EAS (Expo Application Services)**
- Bundle ID: `com.mattbrierley1.stocktonheath`
- Released on the **iOS App Store**; TestFlight is used for pre-release builds
- Running `npm run testflight` from the repo root builds and submits in one step:
  ```bash
  eas build --platform ios --profile production && eas submit --platform ios --latest
  ```
- `npm run ui-update` ships an over-the-air JS-only update to the production channel via `eas update`
- Push notifications are delivered via the **Expo Push Notification service** (acts as an abstraction over APNs)

### Android

`app.json` carries Android configuration (package name, adaptive icon, edge-to-edge), but there is no Android build or submit step in `eas.json` or the npm scripts. iOS is the only shipped platform.

### Environment Variables

**Frontend**

Both public keys are committed into `eas.json` per build profile, so EAS builds pick them up without a local `.env`. A local `.env` with the same two keys is needed for `expo start`:

- `EXPO_PUBLIC_OPENWEATHER_API_KEY` - OpenWeather One Call API key
- `EXPO_PUBLIC_BACKEND_URL` - Backend base URL (`https://stocktonheath.duckdns.org`)

Note that `EXPO_PUBLIC_*` variables are inlined into the client bundle at build time and are therefore readable by anyone with the app - they are not secrets.

**Backend (`backend/.env`)**

- `DATABASE_URL` - Turso libSQL URL
- `TURSO_AUTH_TOKEN` - Turso authentication token
- `TWITTERAPI_IO_API_KEY` - API key for twitterapi.io (used to read tweets)
- `FUEL_FINDER_CLIENT_ID` / `FUEL_FINDER_CLIENT_SECRET` - Gov.uk Fuel Finder OAuth credentials

---

## Monetisation

The app currently carries a single hardcoded sponsor:

- `components/SponsorCard.tsx` - a full "About our sponsor" card on the Home tab
- `components/SponsorBadge.tsx` - a compact "sponsored by" strip on the Services and Bridge tabs

Both reference Rowswood Timber directly, including the logo asset. Changing sponsor currently means editing the components and shipping a build.

---

## Tech Stack Summary

| Layer                | Technology                                                                          |
| -------------------- | ----------------------------------------------------------------------------------- |
| Mobile app           | Expo SDK 54, React Native, TypeScript                                               |
| Routing              | Expo Router (file-based)                                                            |
| State / data         | React hooks, AsyncStorage for local caching                                         |
| Backend              | Node.js 22, Express 5, TypeScript                                                   |
| Database             | Turso (libSQL/SQLite) via Prisma 7                                                  |
| Push notifications   | Expo Push Notification service (APNs under the hood)                                |
| Containerisation     | Docker                                                                              |
| Hosting              | DigitalOcean Droplet                                                                |
| Build / distribution | EAS Build, EAS Submit, EAS Update, App Store                                        |
| External APIs        | OpenWeather One Call, twitterapi.io, Gov.uk Fuel Finder, Warrington Borough Council |

---

## Location Context

Stockton Heath is a village suburb of Warrington in Cheshire, England. Key local landmarks referenced in the app:

- **Latchford Swing Bridge** - a road bridge over the Manchester Ship Canal that closes periodically, causing disruption; the bridge alerts feature monitors this
- **Broomfields Leisure Centre** - local council-run sports and fitness facility
- **Medical centres** - Stockton Heath, Latchford and Stretton surgeries
- **Stockton Heath Post Office** - local post office on London Road
- **Household Waste Recycling Centres** - Lymm Road (Thelwall) and Woolston
- Local petrol stations: ASDA Wilderspool Causeway, ESSO Latchford, Morrisons Stockton Heath
