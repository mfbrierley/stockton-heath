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
| `GET /test-key` 🔒                   | Reports whether the twitterapi.io key is configured     |
| `GET /bridge-alerts`                 | All stored bridge alerts, newest first                  |
| `GET /bridge-alerts/latest`          | Most recent bridge alert only                           |
| `GET /bridge-alerts/check/:userName` 🔒 | Manually trigger a poll from a given Twitter username |
| `POST /bridge-alerts/test-notification` 🔒 | Sends a fake bridge alert push to every subscriber |
| `POST /bridge-subscriptions`         | Register an Expo push token for bridge alerts           |
| `DELETE /bridge-subscriptions`       | Unregister a token from bridge alerts                   |
| `POST /bin-subscriptions`            | Register a token + UPRN for bin reminders               |
| `DELETE /bin-subscriptions`          | Unregister a token from bin reminders                   |
| `GET /fuel-prices`                   | Cached fuel prices for local stations                   |
| `GET /business-listings`             | Live Local Offers listings (`approved && active` only)  |
| `GET /business-listings/pending` 🔒  | Listings awaiting manual approval                       |
| `POST /business-listings/:id/approve` 🔒 | Mark a listing as meeting the discount rule         |
| `POST /business-listings/:id/unapprove` 🔒 | Withdraw approval                                 |
| `POST /business-listings/me` 🔑      | A business creates its own listing after signing up     |
| `GET /business-listings/me` 🔑       | The caller's own listing (404 before they create one)   |
| `PATCH /business-listings/me` 🔑     | Edit listing content                                    |
| `POST /business-listings/me/checkout` 🔑 | Stripe Checkout session URL                         |
| `POST /business-listings/me/portal` 🔑 | Stripe Customer Portal session URL                    |
| `POST /business-listings/me/cancel` 🔑 | Cancel at period end                                  |
| `POST /business-listings/me/image-upload-url` 🔑 | Signed R2 upload URL                        |
| `POST /stripe/webhook`               | Stripe subscription events (signature-verified)         |

🔑 marks a business portal route, authenticated by a Clerk session token via `requireBusinessAuth`.

🔒 marks an admin-only route. These require an `x-admin-token` header matching the `ADMIN_TOKEN` environment variable, enforced by the `requireAdmin` middleware in `src/index.ts`. The comparison is timing-safe, and the check **fails closed** - if `ADMIN_TOKEN` is unset the routes return `503` rather than falling open. They are gated because they either spend money (a metered twitterapi.io call) or reach every subscribed device (push).

All other routes are public and unauthenticated, which is intended - they are read-only or accept only an Expo push token. There is no rate limiting, and `cors` is a dependency but is not wired up (it isn't needed while the only client is the native app).

### Database

Uses **Turso** (a hosted libSQL/SQLite service) via **Prisma** ORM. Five tables:

- `BridgeAlert` - each detected bridge closure tweet (tweetId, tweetText, postedAt, detectedAt)
- `BridgeSubscription` - Expo push tokens subscribed to bridge alerts
- `BinSubscription` - Expo push tokens subscribed to bin reminders, each paired with a UPRN
- `AppMeta` - simple key/value store; currently holds `lastBinNotificationDate` for reminder de-duplication
- `BusinessListing` - a paid Local Offers listing. `approved` (manual editorial review) and `active` (Stripe subscription in good standing) are independent; a listing reaches the app only when both are true

#### Migrations are applied by hand

**Do not point Prisma's migration commands at the live database.** The files in `backend/prisma/migrations/` are kept as a record of the schema, but the live Turso database has no `_prisma_migrations` table - its tables were created by running the SQL directly. Consequently:

- `prisma migrate dev` would see drift and **reset the database**, destroying every Expo push token. Those exist nowhere else, and losing them silently stops bin and bridge notifications for every subscribed user, with no recovery short of each of them toggling the setting off and on.
- `prisma migrate deploy` would treat the database as empty and fail partway through recreating tables that already exist, leaving migrations in a failed state that blocks future ones.

To add a table, write the migration file for the record, then apply its SQL directly:

```bash
turso db shell stockton-heath < backend/prisma/migrations/<name>/migration.sql
```

Nothing applies migrations automatically - the Dockerfile only runs `prisma generate && tsc`. (`backend/dbsetup.js` does call `prisma migrate deploy`, but it is a leftover from an abandoned Fly.io setup, is never copied into the image, and is never executed. It is misleading and worth deleting.)

Two historical notes: the original `PushToken` table was replaced by the two subscription tables in `20260601000000_replace_push_token_with_subscriptions`; and `AppMeta` was absent from the live database until August 2026, which meant bin reminders fell back to an in-memory guard and could double-send if the container restarted between 18:00 and 19:00 UK.

### Background Jobs

All scheduled with `setInterval` in `backend/src/index.ts` - there is no cron or job runner.

- **Bridge polling** (every 10 minutes, 6am-10pm UK time): checks twitterapi.io for new tweets from `@trafficwarr` containing "Swingbridge Alert". If a new one is found, it saves it to the database and pushes to all bridge subscribers via the Expo Push Notification service.
- **Fuel price polling** (every 30 minutes): fetches fresh prices from the Gov.uk Fuel Finder API using OAuth client credentials. Results are cached in memory.
- **Bin reminders** (checked every minute, fires at 18:00 UK time): groups bin subscriptions by UPRN, queries the council API for each, and pushes "Put out your \<bins\> tonight" to anyone with a collection tomorrow. De-duplicated per day via `AppMeta` so a redeploy can't double-send.

Invalid Expo push tokens returned by the push service are pruned from the relevant subscription table automatically.

---

## Infrastructure & Deployment

### Backend

- Hosted on a **DigitalOcean Droplet** (Ubuntu) - 1 vCPU, 1GB RAM, 25GB disk
- Domain: `https://stocktonheath.duckdns.org` (DuckDNS for dynamic DNS)
- Runs as a plain **Docker container** (`docker run`) on port 3001
- Deployed with `npm run deploy:backend`, which SSHes into the droplet, pulls, prunes dangling images, rebuilds and restarts the container
- No CI/CD pipeline - all deployments are manual

The deploy command is one `&&` chain, which gives it two behaviours worth knowing:

- **A build failure is safe.** The chain stops before `docker stop`, so the running container is never touched.
- **A boot failure is not.** Once `docker stop && docker rm` have run the old container is gone, so a container that crashes on startup leaves the backend down - no weather, fuel, bridge alerts or bin reminders. This is why nothing in `index.ts` throws at boot over missing configuration; missing config disables its own feature and nothing else.

Two constraints have blocked deploys before:

- **Disk.** Every deploy left the previous image untagged and nothing removed them, reaching 99.8% of a 10GB disk. `deploy:backend` now runs `docker image prune -f` before building.
- **Memory.** `tsc` needs a little over 256MB and Node caps its own heap from available RAM, so builds died with "JavaScript heap out of memory". The Dockerfile sets `NODE_OPTIONS=--max-old-space-size=512` for the build.

`backend/Dockerfile` installs, builds and prunes in a **single** `RUN`. A later layer cannot reclaim space from an earlier one, so splitting them shipped the entire dev dependency tree inside the image no matter what the prune removed. `backend/package.json` also once listed `expo`, `react` and `react-native`, which dragged the whole React Native and iOS toolchain into the server image - 978 packages for a server that needs 287.

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
- `ADMIN_TOKEN` - shared secret for the admin-only routes above. Generate with `openssl rand -hex 32`. Without it those routes return `503`.
- `FUEL_FINDER_CLIENT_ID` / `FUEL_FINDER_CLIENT_SECRET` - Gov.uk Fuel Finder OAuth credentials

Local Offers (all optional - each route returns `503` until the variables it needs are set). As of August 2026 everything except the four `R2_*` values is configured on the droplet, with Stripe in a test-mode sandbox:

- `CLERK_SECRET_KEY` - Clerk backend API key; verifies portal session tokens and reads the signed-in business's email address
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - signing secret for `POST /stripe/webhook`
- `STRIPE_PRICE_ID` - the £20/month recurring price
- `PORTAL_BASE_URL` - the portal's base URL, currently `https://stockton-heath-support.vercel.app/business`. May carry a path: Stripe's redirect URLs are built from the whole value, while CORS compares against its origin alone.
- `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` - Cloudflare R2 credentials for listing images
- `R2_PUBLIC_URL` - base URL images are served from

---

## Monetisation

The app currently carries a single hardcoded sponsor:

- `components/SponsorCard.tsx` - a full "About our sponsor" card on the Home tab
- `components/SponsorBadge.tsx` - a compact "sponsored by" strip on the Services and Bridge tabs

Both reference Rowswood Timber directly, including the logo asset. Changing sponsor currently means editing the components and shipping a build.

### Local Offers

The replacement for the hardcoded sponsor: local businesses pay **£20/month** by Stripe subscription to advertise a **genuine discount** to residents - the editorial rule that keeps the feature useful rather than just advertising. Businesses are emailed a link to the portal, sign themselves up, write their own listing and pay for it.

The portal is a small React app that does not exist yet. It will live in the **`stockton-heath-support`** repo, served at `https://stockton-heath-support.vercel.app/business` - not a separate repository, as originally planned.

- **Authentication** is handled by **Clerk** - it owns sign-up, passwords and password resets, so no credential reaches this backend. The portal sends a Clerk session token as a bearer token and `requireBusinessAuth` verifies it. Sign-up is open: a signed-in caller with no listing is an expected state rather than an error, and creating one is the next thing they do. A listing is owned by the Clerk account that created it (`clerkUserId` is unique, so one account means one listing), and its contact address is read from that account rather than the request body.
- **Nothing a stranger signs up for is visible.** A listing reaches the app only once it is approved and paid, so an unwanted sign-up costs no more than a row in the pending queue.
- **Billing** is Stripe Checkout in subscription mode. `customer.subscription.*` webhooks are the single source of truth for `active`, so cancelling from the portal and cancelling from Stripe's own Customer Portal behave identically. The cancel route sets `cancel_at_period_end` and deliberately does not touch `active` itself.
- **Checkout opts out of Stripe Managed Payments** (`managed_payments: { enabled: false }`). That is Stripe's merchant-of-record product, enabled by default on the account: it adds 3.5% per transaction, requires a product tax code, and would make Stripe rather than the app's owner the party selling advertising. Without opting out, checkout fails outright. It is set in code rather than the dashboard so the decision travels with the repository. The parameter is newer than `stripe@22`'s types, so the params type is extended locally.
- **The webhook needs the raw request body.** `express.raw` is mounted on `/stripe/webhook` above the global `express.json()`; body-parser marks the request as already read, so the JSON parser leaves that one path alone.
- **Images** are uploaded directly to Cloudflare R2 via a short-lived signed URL; the portal PATCHes the resulting public URL back once the upload succeeds.
- Editing `discountText` resets `approved` to `false` so the discount gets re-reviewed. Name, description and image edits do not, so a typo fix can't pull a paying listing out of the app.
- All Local Offers config is read lazily. A missing variable returns `503` from the affected route rather than throwing at boot, because `deploy:backend` removes the running container before starting the new one - a boot-time throw would take weather, fuel, bridge alerts and bin reminders down with it.
- **CORS** is scoped to `PORTAL_BASE_URL` and compares against its **origin**, since a browser's `Origin` header never carries a path and `PORTAL_BASE_URL` does. The mobile app sends no `Origin` header and is unaffected, as are all the pre-existing routes.

#### Verifying it

`backend/scripts/verify-local-offers.mjs` walks the whole flow against the deployed server and real Clerk, without needing the portal: it creates a throwaway Clerk user, mints the same kind of session token the portal will send, then signs up, creates a listing, checks the pending queue, approves, and exercises the editing rules. Integrations that aren't configured report `SKIP` rather than failing.

```bash
cd backend
BACKEND_URL=https://stocktonheath.duckdns.org ADMIN_TOKEN=... CLERK_SECRET_KEY=sk_test_... \
  node scripts/verify-local-offers.mjs
```

It leaves one listing row behind, prints the command to remove it, and prints the Stripe checkout URL - paying that with card `4242 4242 4242 4242` is the only way to exercise the webhook, since nothing else can make Stripe call the server.

#### Current status (August 2026)

| Piece | State |
| --- | --- |
| `BusinessListing` table | created on the live database |
| Admin review routes | working |
| Public route the app reads | working, returns `[]` |
| Clerk sign-up, login, listing creation | working; sign-ups are **open**, not invitation-only |
| Stripe checkout and webhook | configured and paid end to end in a **sandbox** (test mode) |
| Cloudflare R2 image upload | **not configured** - the routes return `503` |
| The business portal | **not built** |
| The app's Local Offers screen | **not built** - nothing to show until a listing is approved and paid |

Stripe is in a sandbox with test keys. Going live means repeating the product, price and webhook setup in the live account and swapping all four `STRIPE_*` values.

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
| Business auth        | Clerk (`@clerk/backend`)                                                            |
| Payments             | Stripe (Checkout, Customer Portal, subscription webhooks)                           |
| Image storage        | Cloudflare R2 (signed uploads via the S3-compatible API)                             |
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
