# Stockton Heath — Project Context

## What is this?

Stockton Heath is a personal side project — a community utility app for **Stockton Heath**, a village in Warrington, Cheshire, UK. It's built for residents of the area and provides useful local information and services in one place: weather, bin collections, fuel prices, bridge closure alerts, and local amenity info.

The app is distributed publicly on iOS via **TestFlight** and eventually the App Store. There is no web version.

---

## The App (Frontend)

Built with **Expo / React Native** — a cross-platform mobile framework using React and TypeScript. Expo Router handles file-based navigation (similar to Next.js for React Native).

### Screens

#### Home Tab

- Displays current **weather** for Stockton Heath (lat/lon hardcoded) using the **OpenWeather One Call API**
- Shows a contextual greeting card based on time of day
- Shows live **local fuel prices** for three nearby petrol stations:
  - ASDA (Wilderspool Causeway)
  - ESSO (Latchford / Knutsford Road)
  - Morrisons (Stockton Heath)
- Fuel prices come from the backend, which polls the UK Government's **Fuel Finder API**

#### Services Tab

- **Bin collection lookup**: user enters their postcode, selects their address from a list, and the app fetches their upcoming bin collection schedule from Warrington Borough Council's public API
- Address and bin data is cached locally so it loads instantly on repeat visits
- Links to:
  - **Recycling Centre** (Lymm Road, Thelwall) — full info screen with accepted items, permit items (DIY waste), and opening hours
  - **Broomfields Leisure Centre** — opening hours, list of facilities (gym, pool, classes, football pitches, venue hire)
  - **Stockton Heath Medical Centre** — opening hours, links to eConsult, appointments, prescriptions, test results
  - **Stockton Heath Post Office** — opening hours, full list of available services (banking, parcels, bills, passport check & send)

#### Bridge Tab

- Shows the latest **swing bridge closure alert** for the Latchford swing bridge (Warrington)
- Alerts are sourced from the **@trafficwarr** Twitter/X account, which posts "Swingbridge Alert" tweets
- Users can **subscribe to push notifications** to be alerted whenever a new bridge closure is detected
- The backend polls Twitter every 10 minutes (6am–10pm UK time only) and sends Expo push notifications to all subscribed devices when a new alert appears

### Design

- Colour scheme: dark green (`#1B4332`) as the primary, with warm neutral backgrounds (`#FCF6EF`)
- Fonts: **NotoSerif** for headings, **Plus Jakarta Sans** for body text
- Icons from `@expo/vector-icons` — Feather icon set is preferred
- Consistent design tokens defined in `app/styles/theme.ts`

---

## The Backend

A **Node.js / Express 5** API server written in TypeScript, deployed on a DigitalOcean Droplet.

### What it does

- Serves as a proxy/cache for fuel price data (fetching from the Gov.uk Fuel Finder API every 30 minutes)
- Polls Twitter (via twitterapi.io) for bridge closure tweets and stores them in a database
- Stores Expo push notification tokens and fans out push notifications when new bridge alerts are found
- Exposes a simple REST API consumed by the mobile app

### API Routes

| Route                                | Description                                           |
| ------------------------------------ | ----------------------------------------------------- |
| `GET /`                              | Health check string                                   |
| `GET /health`                        | JSON `{ ok: true }`                                   |
| `GET /bridge-alerts`                 | All stored bridge alerts, newest first                |
| `GET /bridge-alerts/latest`          | Most recent bridge alert only                         |
| `GET /bridge-alerts/check/:userName` | Manually trigger a poll from a given Twitter username |
| `POST /push-tokens`                  | Register an Expo push notification token              |
| `GET /fuel-prices`                   | Cached fuel prices for local stations                 |

### Database

Uses **Turso** (a hosted libSQL/SQLite service) via **Prisma** ORM. Two tables:

- `BridgeAlert` — stores each detected bridge closure tweet (tweetId, tweetText, postedAt, detectedAt)
- `PushToken` — stores Expo push tokens for subscribed devices

### Background Jobs

- **Bridge polling**: every 10 minutes, 6am–10pm UK time, checks twitterapi.io for new tweets from `@trafficwarr` containing "Swingbridge Alert". If a new one is found, it saves it to the database and sends push notifications to all registered tokens via the Expo Push Notification service.
- **Fuel price polling**: every 30 minutes, fetches fresh prices from the Gov.uk Fuel Finder API using OAuth client credentials. Results are cached in memory.

---

## Infrastructure & Deployment

### Backend

- Hosted on a **DigitalOcean Droplet** (Ubuntu)
- Domain: `https://stocktonheath.duckdns.org` (DuckDNS for dynamic DNS)
- Runs as a plain **Docker container** (`docker run`) on port 3001
- Deployed by SSH-ing into the droplet, pulling the latest code, rebuilding the Docker image, and restarting the container
- No CI/CD pipeline — all deployments are manual

### Frontend (iOS)

- Built and submitted using **EAS (Expo Application Services)**
- Bundle ID: `com.mattbrierley1.stocktonheath`
- Production builds are distributed via **TestFlight**
- Running `npm run testflight` from the repo root builds and submits to TestFlight in one step:
  ```bash
  eas build --platform ios --profile production && eas submit --platform ios --latest
  ```
- Push notifications are delivered via the **Expo Push Notification service** (acts as an abstraction over APNs)

### Environment Variables

**Frontend (`.env`)**

- `EXPO_PUBLIC_OPENWEATHER_API_KEY` — OpenWeather One Call API key
- `EXPO_PUBLIC_BACKEND_URL` — Backend base URL (`https://stocktonheath.duckdns.org`)

**Backend (`backend/.env`)**

- `DATABASE_URL` — Turso libSQL URL
- `TURSO_AUTH_TOKEN` — Turso authentication token
- `TWITTERAPI_IO_API_KEY` — API key for twitterapi.io (used to read tweets)
- `FUEL_FINDER_CLIENT_ID` / `FUEL_FINDER_CLIENT_SECRET` — Gov.uk Fuel Finder OAuth credentials

---

## Tech Stack Summary

| Layer                | Technology                                                                          |
| -------------------- | ----------------------------------------------------------------------------------- |
| Mobile app           | Expo SDK 54, React Native, TypeScript                                               |
| Routing              | Expo Router (file-based)                                                            |
| State / data         | React hooks, AsyncStorage for local caching                                         |
| Backend              | Node.js 22, Express 5, TypeScript                                                   |
| Database             | Turso (libSQL/SQLite) via Prisma                                                    |
| Push notifications   | Expo Push Notification service (APNs under the hood)                                |
| Containerisation     | Docker                                                                              |
| Hosting              | DigitalOcean Droplet                                                                |
| Build / distribution | EAS Build, EAS Submit, TestFlight                                                   |
| External APIs        | OpenWeather One Call, twitterapi.io, Gov.uk Fuel Finder, Warrington Borough Council |

---

## Location Context

Stockton Heath is a village suburb of Warrington in Cheshire, England. Key local landmarks referenced in the app:

- **Latchford Swing Bridge** — a road bridge over the Manchester Ship Canal that closes periodically, causing disruption; the bridge alerts feature monitors this
- **Broomfields Leisure Centre** — local council-run sports and fitness facility
- **Stockton Heath Medical Centre** — local GP surgery
- **Stockton Heath Post Office** — local post office on London Road
- **Lymm Road Household Waste Recycling Centre** — the nearest tip/recycling centre in Thelwall
- Local petrol stations: ASDA Wilderspool Causeway, ESSO Latchford, Morrisons Stockton Heath
