# Copilot Instructions — Stockton Heath

## Project Overview

A local community app for Stockton Heath, Warrington (UK). Built with **Expo / React Native** (mobile-first, iOS + Android) and a **Node.js/Express backend**.

---

## Repository Structure

```
/                         # Expo React Native app (frontend)
  app/                    # Expo Router file-based routing
    (tabs)/               # Bottom tab screens
      index.tsx           # Home tab – weather + local fuel prices
      services.tsx        # Bin collections / waste services
      discounts.tsx       # Local discounts (placeholder)
      bridge.tsx          # Swing bridge alerts + push notification opt-in
    recycling-centre.tsx  # Full-page recycling centre info (modal/stack route)
    _layout.tsx           # Root layout (fonts, notifications)
    styles/
      theme.ts            # Design tokens (colours, fonts, font sizes)
      globalStyles.ts     # Shared StyleSheet styles
    types/
      binCollections.ts   # Types for Warrington bin collection API
  components/             # Shared UI components
  hooks/                  # Custom hooks
  assets/                 # Images, icons

backend/                  # Node.js/Express API server
  src/index.ts            # Single-file server (all routes + polling logic)
  prisma/schema.prisma    # Prisma schema (SQLite via Turso/libSQL)
  Dockerfile              # Container build
```

---

## Frontend (Expo / React Native)

- **Framework:** Expo SDK 54, Expo Router (file-based routing)
- **Language:** TypeScript (strict)
- **Styling:** React Native StyleSheet + design tokens from `app/styles/theme.ts`
- **Fonts:** NotoSerif (headings), Plus Jakarta Sans (body) via `@expo-google-fonts`
- **Icons:** `@expo/vector-icons` (Feather, MaterialCommunityIcons, Ionicons. Feather is priortiy for new icons)
- **Key dependencies:** `expo-notifications`, `expo-constants`, `expo-image`, `@react-native-async-storage/async-storage`
- **Bundle ID (iOS):** `com.mattbrierley1.stocktonheath`

### Environment variables (frontend `.env`)

| Variable                          | Purpose                                                |
| --------------------------------- | ------------------------------------------------------ |
| `EXPO_PUBLIC_OPENWEATHER_API_KEY` | OpenWeather One Call API                               |
| `EXPO_PUBLIC_BACKEND_URL`         | Backend base URL (`https://stocktonheath.duckdns.org`) |

### Screens

| Screen                      | Description                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| Home (`index.tsx`)          | Weather (OpenWeather API, lat/lon hardcoded to Stockton Heath) + local fuel prices from backend |
| Services (`services.tsx`)   | Postcode-based bin collection lookup via Warrington Borough Council API                         |
| Bridge (`bridge.tsx`)       | Latest swing bridge closure alert + push notification subscribe                                 |
| Discounts (`discounts.tsx`) | Placeholder — local business discounts (not yet built)                                          |
| Recycling Centre            | Static info page: accepted/not-accepted items, permit items, opening hours                      |

### Location constants

```ts
const LATITUDE = 53.3705;
const LONGITUDE = -2.5811; // Stockton Heath, Warrington
```

---

## Backend (Node.js / Express)

- **Language:** TypeScript, compiled with `tsc` to `dist/`
- **Runtime:** Node 22
- **Framework:** Express 5
- **Database:** Turso (libSQL/SQLite) via Prisma with `@prisma/adapter-libsql`
- **Port:** 3001
- **Deployment:** DigitalOcean Droplet at `https://stocktonheath.duckdns.org`

### Environment variables (backend `backend/.env`)

| Variable                    | Purpose                                   |
| --------------------------- | ----------------------------------------- |
| `DATABASE_URL`              | Turso libSQL URL                          |
| `TURSO_AUTH_TOKEN`          | Turso auth token                          |
| `TWITTERAPI_IO_API_KEY`     | twitterapi.io key for bridge alert tweets |
| `FUEL_FINDER_CLIENT_ID`     | Gov.uk Fuel Finder OAuth client ID        |
| `FUEL_FINDER_CLIENT_SECRET` | Gov.uk Fuel Finder OAuth client secret    |

### API Routes

| Method | Route                            | Description                                   |
| ------ | -------------------------------- | --------------------------------------------- |
| GET    | `/`                              | Health check string                           |
| GET    | `/health`                        | JSON `{ ok: true }`                           |
| GET    | `/bridge-alerts`                 | All bridge alerts (newest first)              |
| GET    | `/bridge-alerts/latest`          | Most recent bridge alert                      |
| GET    | `/bridge-alerts/check/:userName` | Trigger a manual poll from a Twitter username |
| POST   | `/push-tokens`                   | Register an Expo push token                   |
| GET    | `/fuel-prices`                   | Cached local fuel prices                      |

### Background polling

- **Bridge alerts:** polls `twitterapi.io` every **10 minutes** for tweets from `trafficwarr` containing "Swingbridge Alert". Only runs 6am–10pm UK time. Sends Expo push notifications on new alerts.
- **Fuel prices:** polls Gov.uk Fuel Finder API every **30 minutes**, caches results in memory for 3 local stations (Wilderspool Causeway, Latchford, Morrisons).

### Database models (Prisma)

```prisma
model BridgeAlert {
  id         Int    @id @default(autoincrement())
  tweetId    String @unique
  tweetText  String
  postedAt   String
  detectedAt String
}

model PushToken {
  id    Int    @id @default(autoincrement())
  token String @unique
}
```

---

## Infrastructure

- **Backend hosting:** DigitalOcean Droplet (migrated from Fly.io)
- **Backend domain:** `https://stocktonheath.duckdns.org` (DuckDNS)
- **Database:** Turso (remote libSQL) — `stockton-heath-mattbrierley.aws-eu-west-1.turso.io`
- **Push notifications:** Expo Push Notification service (`exp.host/push/send`)
- **App distribution:** EAS Build / EAS Submit

### Backend Deployment

The repo is cloned at `/opt/stockton-heath` on the droplet. The backend runs as a plain `docker run` container (no compose) named `stockton-heath-backend` on port 3001. To redeploy after backend changes:

```bash
cd /opt/stockton-heath && git pull
docker build -t stockton-heath-backend ./backend
docker stop stockton-heath-backend && docker rm stockton-heath-backend
docker run -d \
  --name stockton-heath-backend \
  --restart unless-stopped \
  -p 3001:3001 \
  --env-file ./backend/.env \
  stockton-heath-backend
```

---

## Design Tokens (theme.ts)

- **Primary colour:** `#1B4332` (dark green)
- **Secondary:** `#6DA688`, **Tertiary:** `#2D6A4F`
- **Background (app):** `#FCF6EF` (neutral100) / `#F5EBE0` (neutral200)
- **Status colours:** green `#16A34A`, amber `#D97706`, red `#DC2626`
- **Heading font:** `NotoSerif` / `NotoSerifBold`
- **Body font:** `PlusJakartaSans` / `PlusJakartaSansBold`

---

## Conventions

- Use TypeScript strict mode everywhere
- Backend: `moduleResolution: node10`, `module: CommonJS`, target `ES2022`
- Frontend: extends `expo/tsconfig.base` (bundler module resolution)
- Prefer `void` for fire-and-forget async calls
- All API calls from the frontend use `EXPO_PUBLIC_BACKEND_URL` env var
- External Warrington Council API used directly from the frontend (no proxy): `https://www.warrington.gov.uk/bin-collections/get-addresses/uprn/{postcode}`
