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
| `GET /business-listings/admin` 🔒    | Every listing, unapproved first, for the approvals and Listings screens. Each carries a `stripeUrl` straight to the subscription (or the customer) in the Stripe dashboard |
| `POST /business-listings/:id/approve` 🔒 | Mark a listing as meeting the discount rule         |
| `POST /business-listings/:id/unapprove` 🔒 | Withdraw approval                                 |
| `POST /business-listings/:id/remove` 🔒 | Take a listing out for good: cancels its Stripe subscription immediately, then deletes the row |
| `GET /admin/users` 🔒                | Every Clerk account with its listing, if it has one, for the admin Users page. Each listing carries a `stripeUrl` straight to the subscription (or the customer) in the Stripe dashboard |
| `DELETE /admin/users/:clerkUserId` 🔒 | Erase a person: their Stripe customer, their listing, then their Clerk account. Frees their email for a fresh signup. Refuses while their listing is still paying, and refuses the owner's own account |
| `POST /business-listings/me` 🔑      | A business creates its own listing after signing up     |
| `GET /business-listings/me` 🔑       | The caller's own listing (404 before they create one)   |
| `GET /business-listings/me/is-owner` 🔑 | Whether the caller is the owner, so the portal knows whether to offer the approvals link |
| `PATCH /business-listings/me` 🔑     | Edit listing content                                    |
| `POST /business-listings/me/checkout` 🔑 | Stripe Checkout session URL                         |
| `POST /business-listings/me/portal` 🔑 | Stripe Customer Portal session URL. `{ flow: "payment_method_update" }` sends them straight to the card form and has Stripe redirect them back when done, rather than leaving them on the portal home with only a small "return to" link |
| `POST /business-listings/me/cancel` 🔑 | Cancel at period end                                  |
| `POST /business-listings/me/resume` 🔑 | Undo a pending cancellation                           |
| `POST /business-listings/me/image-upload-url` 🔑 | Signed R2 upload URL                        |
| `POST /stripe/webhook`               | Stripe subscription events (signature-verified)         |

🔑 marks a business portal route, authenticated by a Clerk session token via `requireBusinessAuth`.

🔒 routes accept **either** the `x-admin-token` header or a Clerk session token belonging to
`OWNER_EMAIL`, so approvals work from the portal UI as well as from a script. With no
`OWNER_EMAIL` set only the token works, exactly as before.

🔒 marks an admin-only route. These require an `x-admin-token` header matching the `ADMIN_TOKEN` environment variable, enforced by the `requireAdmin` middleware in `src/index.ts`. The comparison is timing-safe, and the check **fails closed** - if `ADMIN_TOKEN` is unset the routes return `503` rather than falling open. They are gated because they either spend money (a metered twitterapi.io call) or reach every subscribed device (push).

All other routes are public and unauthenticated, which is intended - they are read-only or accept only an Expo push token. There is no rate limiting, and `cors` is a dependency but is not wired up (it isn't needed while the only client is the native app).

### Database

Uses **Turso** (a hosted libSQL/SQLite service) via **Prisma** ORM. Five tables:

- `BridgeAlert` - each detected bridge closure tweet (tweetId, tweetText, postedAt, detectedAt)
- `BridgeSubscription` - Expo push tokens subscribed to bridge alerts
- `BinSubscription` - Expo push tokens subscribed to bin reminders, each paired with a UPRN
- `AppMeta` - simple key/value store; currently holds `lastBinNotificationDate` for reminder de-duplication
- `WelcomedUser` - one row per business account already sent a welcome email. Clerk owns sign-up and never tells this backend about it, so the first authenticated request an account makes stands in for the event, and this table is the only thing that can tell that request from every one after it
- `BusinessListing` - a paid Local Offers listing. `approved` (manual editorial review) and `active` (Stripe subscription in good standing) are independent; a listing reaches the app only when both are true. `cancelAtPeriodEnd` and `currentPeriodEnd` mirror Stripe so the portal can show a pending cancellation: `active` stays true through one, because the business has paid to the end of the period, and without these two a cancelled subscription is indistinguishable from a healthy one after a page reload

#### Migrations are applied by hand

**Do not point Prisma's migration commands at the live database.** The files in `backend/prisma/migrations/` are kept as a record of the schema, but the live Turso database has no `_prisma_migrations` table - its tables were created by running the SQL directly. Consequently:

- `prisma migrate dev` would see drift and **reset the database**, destroying every Expo push token. Those exist nowhere else, and losing them silently stops bin and bridge notifications for every subscribed user, with no recovery short of each of them toggling the setting off and on.
- `prisma migrate deploy` would treat the database as empty and fail partway through recreating tables that already exist, leaving migrations in a failed state that blocks future ones.

To add a table **or a column**, write the migration file for the record, then apply its SQL directly:

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
- `STRIPE_TAX_RATE_ID` - **optional.** A Stripe Tax Rate id (`txr_...`) for UK VAT at 20%,
  created once in Dashboard → Tax rates. Set it and VAT is added on top of the £20 at
  checkout and on every renewal, the portal advertises the price as excluding VAT, and each
  payment emails a link to the VAT invoice. Leave it unset and the £20 is the whole of what
  is charged, with no VAT mentioned anywhere - which is the correct state until the business
  is VAT registered, because an invoice cannot show a VAT number that does not exist yet.
  Set the portal's `VITE_PRICE_EXCLUDES_VAT` at the same time; one says what is charged, the
  other says what is advertised, and they are meant to agree.
  Two things in the Stripe dashboard have to be right for the invoice to be a valid VAT
  invoice: the VAT number under Settings → Business, and `invoice.paid` in the webhook's
  event list.
- `PORTAL_BASE_URL` - the portal's base URL, currently `https://stockton-heath-support.vercel.app/business`. May carry a path: Stripe's redirect URLs are built from the whole value, while CORS compares against its origin alone.
- `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` - Cloudflare R2 credentials for listing images
- `R2_PUBLIC_URL` - base URL images are served from

Notification email (optional - with none of it set, nothing is sent and every request still
succeeds; failures are logged, never returned to the caller).

Sent through the **Gmail API over HTTPS**, not SMTP. DigitalOcean blocks outbound SMTP on
every droplet (ports 25, 465 and 587) and declined to lift it, so nodemailer could never
open a connection. The Gmail API runs on 443 and mail genuinely comes from the authorising
account, so deliverability is Gmail's own.

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - an OAuth **Desktop app** client from the
  Google Cloud console, with the Gmail API enabled
- `GOOGLE_REFRESH_TOKEN` - produced by `backend/scripts/get-gmail-refresh-token.mjs`, which
  walks the one-off consent flow. Google revokes it if the account password is reset, and
  after 7 days while the OAuth app is still in "Testing" - **publish the app** to avoid that.
- `GMAIL_ADDRESS` - the address mail is sent from; must be the account that authorised
- `OWNER_EMAIL` - where "needs approving" and "new subscriber" notices go, and the account
  allowed to approve from the portal UI. Defaults to `GMAIL_ADDRESS` for notifications, but
  must be set explicitly to enable owner approval from the browser.
- `MAIL_FROM` - optional display sender, defaults to `Stockton Heath <GMAIL_ADDRESS>`

---

## Before going live

Everything below is the owner's to do by hand - dashboards and environment
variables, not code. The code for all of it is written and merged; it sits
switched off until these are done, which is deliberate.

### VAT (added August 2026, not yet switched on)

The price is advertised as £20 excluding VAT, so Stripe adds 20% and every
payment produces a VAT invoice. Nothing happens until all five of these are
done, and doing them in the wrong order is worse than not starting:

1. **Stripe → Settings → Business**: add the VAT registration number. This is
   what makes the invoice a *VAT* invoice rather than a receipt; without it the
   emails still send and are still not the document a customer needs.
2. **Stripe → Tax rates**: create UK VAT at 20%, **exclusive** (not inclusive -
   inclusive would take the VAT out of the £20 rather than add it on top).
   Copy the `txr_...` id.
3. **Droplet**: set `STRIPE_TAX_RATE_ID` to that id, then `npm run
   deploy:backend`.
4. **Stripe → Webhooks**: add `invoice.paid` to the endpoint's event list.
   Without it no invoice email is ever sent, and nothing anywhere will
   complain - the event simply never arrives.
5. **Vercel**: set `VITE_PRICE_EXCLUDES_VAT=true` and redeploy.

Steps 3-5 belong on the same day in either order. Between 3 and 5 the site
advertises £20 while Stripe charges £24, which is the one genuinely bad state.

**Leave Stripe's own invoice emails off** (Settings → Customer emails →
"Successful payments"). The backend sends one carrying a link to the hosted
invoice; turning Stripe's on as well means two emails for every payment.

### Also outstanding

- **Stripe is a test-mode sandbox.** Real cards do nothing until it is switched
  to live, which also means new keys on the droplet.
- **Clerk is a development instance.** A production instance has its own keys
  and its own domain setup.
- **Clerk password `min_length` is 15**, which is unusually strict for a
  business signing up from a leaflet. 8 is the normal floor. Dashboard only.
- **Photo upload is unbuilt.** The four `R2_*` variables are unset, so the
  route returns 503 by design and the portal has no photo field.

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
- **A new account is welcomed on its first authenticated request**, because Clerk owns sign-up and never tells this backend it happened. `requireBusinessAuth` only looks for a `WelcomedUser` row when the caller has **no listing** - anyone with one was welcomed long ago - so the extra lookup is paid by new signups and very little else. The insert is the lock: whoever creates the row sends the emails, so two requests arriving together cannot both send. The Clerk lookup happens before the insert, so a Clerk failure leaves no row and the next request tries again rather than marking someone welcomed having sent nothing. The owner gets a row but no email.
- **Deleting a user is an erasure, and looks their listing up by email as well as Clerk id.** The two normally agree, but a Clerk account deleted and remade with the same address leaves a row pointing at the old id - and `contactEmail` is unique, so a row matched by neither would hold that address for ever with no login left to reach it. It deletes their Stripe customer too, found by email rather than by the row's `stripeCustomerId`, so a listing removed on its own doesn't strand one. Stripe first, then the row, then the account: every step is safe to repeat, so a failure part-way is retried by pressing Delete again. Invoices and charges survive at Stripe on purpose - they are financial records and not ours to throw away.
- **An admin has two ways to take a listing down, and they are deliberately different.** Unapproving hides it while it carries on paying, and is undone with one click - that is the one to reach for. Removing it (`/remove`) cancels the subscription **there and then** rather than at the end of the period, because a business should not be charged for a month no resident can see; it then deletes the row outright, which frees the business's email and Clerk id, so signing in afterwards looks exactly like the first visit ever did, and emails the business to say their discount is out of the app and their subscription is stopped. Not undoable from the portal. Deleting a user goes through the same route, so the two can't drift apart.
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
