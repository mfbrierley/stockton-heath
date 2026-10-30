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
- **Discounts announcement** (`DiscountsAnnouncement`) - a temporary launch notice between the greeting and the weather: "New: save money at local businesses around Stockton Heath with discounts for people with the app", tapping through to the Discounts tab. Shown only when the tab is (`useDiscountsLive`). It can be closed (remembered in AsyncStorage) and stops showing on its own after `ANNOUNCEMENT_EXPIRY`, 1 January 2027 - delete it once that has passed. It replaced the NHS dentists notice that sat in the same spot
- Displays current **weather** for Stockton Heath from the backend, which reads the **OpenWeather One Call API** every 10 minutes. Until October 2026 every phone called OpenWeather itself with a key built into the app, so each app open was a call on the account
- Shows live **local fuel prices** for three nearby petrol stations:
  - ASDA (Wilderspool Causeway)
  - ESSO (Latchford / Knutsford Road)
  - Morrisons (Stockton Heath)
- Fuel prices come from the backend, which polls the UK Government's **Fuel Finder API**
- **Sponsor card** - a paid placement for a local business (currently Rowswood Timber). Hardcoded in `components/SponsorCard.tsx`
- Summary cards linking through to local discounts, bin collections and bridge alerts
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
  - **NHS Dentists** (`/nhs-dentists`) - every NHS dental practice within 5 miles, nearest first, with whether it is taking on new NHS patients (adults, children, adults entitled to free care), when the practice last confirmed that, and links to call it or open its nhs.uk page. A List / Map toggle switches to a map with a pin per practice, coloured by status; tapping a pin shows the practice with Call and NHS website buttons - see [NHS dentists](#nhs-dentists). Read daily from nhs.uk by the backend

#### Discounts Tab

- The resident-facing half of Local Offers: a list of every listing that is
  both approved and paid for, read from `GET /business-listings`
- One card per business - photo (when there is one), business name, the
  discount as a green pill, and the terms underneath. Drawn to match
  `DiscountPreview` in the portal, which is what a business writes their
  listing against under the heading "How residents will see it"
- Searchable by business name or discount wording, and filterable by category
  from a row of chips above the list. The chips are built from the categories
  the listings actually use, not from a copy of the backend's list, so they
  cannot drift out of step with it and no chip ever returns nothing
- Pull-to-refresh
- Refetches whenever the tab is focused rather than caching. A listing leaves
  the app the moment anything residents see on it is edited, and removing one
  deletes the row, so a cached copy would advertise a discount that has been
  withdrawn
- Says under the heading that every discount is checked before it goes in
- An email link at the bottom (`info@stocktonheathapp.com`) for residents who
  run a business; they're sent the link to the business page. Not a link to
  the portal from the app itself: a link from inside the app to a page selling
  placement in it invites App Review questions
- **Shown only once there is something to show** (`hooks/useDiscountsLive.ts`).
  The tab and the Home card appear when `GET /business-listings` returns a
  non-empty list, which the backend refuses to do before launch day - see
  [Launch and the free month](#launch-and-the-free-month). So the page appears
  on 30 October without anything shipping that day, and never opens onto an
  empty list. Checked at start-up and whenever the app returns to the
  foreground; hidden until the first answer, and always shown in development.
  `href: null` keeps the route registered, so `stocktonheath://discounts`
  still reaches it

#### Bridge Tab

- Shows the latest **swing bridge closure alert** for the Latchford swing bridge (Warrington)
- Alerts are sourced from the **@trafficwarr** Twitter/X account, which posts automated tweets naming the "Swingbridge" (e.g. "A50 Knutsford Road Swingbridge will close to traffic in about 25 minutes...")
- Users can **subscribe to push notifications** to be alerted whenever a new bridge closure is detected
- **Closure history chart** (`BridgeClosuresChart`) - a hand-rolled SVG chart of recent closure frequency
- The backend polls Twitter every 10 minutes (6am-10pm UK time only) and sends Expo push notifications to all subscribed devices when a new alert appears

#### Other Screens

- **About** (`/about`) - app version, credits, the disclaimer that this is an
  unofficial app, and every data source with a working link to its publisher
- **Help** (`/help`) - FAQs covering bin lookup, bridge alerts and notifications,
  opening with "Is this an official Warrington Borough Council app?"

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
- Reads the weather from OpenWeather every 10 minutes and caches it, so every phone shares one reading
- Reads which nearby NHS dentists are taking on new patients from nhs.uk once a day, and caches it
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
| `POST /bridge-alerts/test-notification` 🔒 | Sends a fake bridge alert push to **one** device. Requires `{"token": "ExponentPushToken[...]"}` in the body; 400 without it. It used to fan out to every subscriber, which put a fake closure alert on every user's phone with no undo |
| `POST /notifications/broadcast` 🔒   | An ad hoc push to every subscribed device (bridge, bin or both, each device once), optionally opening a screen when tapped. Never sends on the first call - see [Sending a broadcast](#sending-a-broadcast) |
| `POST /bridge-subscriptions`         | Register an Expo push token for bridge alerts           |
| `DELETE /bridge-subscriptions`       | Unregister a token from bridge alerts                   |
| `POST /bin-subscriptions`            | Register a token + UPRN for bin reminders               |
| `DELETE /bin-subscriptions`          | Unregister a token from bin reminders                   |
| `GET /fuel-prices`                   | Cached fuel prices for local stations                   |
| `GET /weather`                       | Cached OpenWeather One Call reading (`current` and `hourly`) with its `fetchedAt`. `503` until the first read after a restart, without `OPENWEATHER_API_KEY`, or once the last good reading is over an hour old |
| `GET /nhs-dentists`                  | Cached NHS dental practices within 5 miles and whether each is taking on new NHS patients. `503` until the first read of nhs.uk after a restart |
| `GET /business-listings`             | Live Local Offers listings (`approved && active` only). **Empty until launch** - see [Launch and the free month](#launch-and-the-free-month) |
| `GET /business-listings/launch`      | The launch date, the free-month end date, and whether subscribing now starts with the free month. Public; the portal reads it |
| `GET /business-listings/pending` 🔒  | Listings awaiting manual approval                       |
| `GET /business-listings/admin` 🔒    | Every listing, unapproved first, for the approvals and Listings screens. Each carries a `stripeUrl` straight to the subscription (or the customer) in the Stripe dashboard |
| `POST /business-listings/:id/approve` 🔒 | Mark a listing as meeting the discount rule         |
| `POST /business-listings/:id/unapprove` 🔒 | Withdraw approval                                 |
| `POST /business-listings/:id/remove` 🔒 | Take a listing out for good: cancels its Stripe subscription immediately, then deletes the row |
| `GET /admin/users` 🔒                | Every Clerk account with its listing, if it has one, for the admin Users page. Each listing carries a `stripeUrl` straight to the subscription (or the customer) in the Stripe dashboard |
| `POST /get-hits`                     | Counts one opening of the website's download link (`/get`), by UK day, `src` tag, kind of phone (`platform`: `ios`, `android`, `other`) and the app it was opened in (`via`: `facebook`, `instagram`, `browser`). Always `204`; anything else in the query is ignored. Totals only, in `AppMeta`; at most 200 new rows a day. Reached through a rewrite on the website, not called by the app |
| `GET /admin/download-link` 🔒        | Those totals for the last `days` days (default 30, today included), newest first, for the portal's Admin > Download link page |
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

#### Sending a broadcast

`POST /notifications/broadcast` reaches every device subscribed to bridge alerts or bin
reminders. That is as close to "every user" as the backend gets: the app only asks for a push
token when someone turns one of those on, so a user who never did cannot be reached. There is
no undo, so the route works in steps:

```bash
H=(-H "x-admin-token: $ADMIN_TOKEN" -H "Content-Type: application/json")
URL=https://stocktonheath.duckdns.org/notifications/broadcast

# 1. Check it on your own phone. Sends to that one device only.
curl -X POST $URL "${H[@]}" -d '{"title":"Stockton Heath","body":"...","link":"/nhs-dentists","token":"ExponentPushToken[...]"}'

# 2. Dry run: returns the recipient count and sends nothing.
curl -X POST $URL "${H[@]}" -d '{"title":"Stockton Heath","body":"...","link":"/nhs-dentists"}'

# 3. Send, passing back the count from step 2.
curl -X POST $URL "${H[@]}" -d '{"title":"Stockton Heath","body":"...","link":"/nhs-dentists","confirm":123}'
```

To find your own token for step 1, turn bridge alerts off and on in the app - that makes
your phone the newest row - then:

```bash
turso db shell stockton-heath "SELECT token FROM BridgeSubscription ORDER BY id DESC LIMIT 1;"
```

`link` is optional: a screen in the app for the tap to open, such as `/nhs-dentists`. It must
be an app route - letters, digits and hyphens between slashes, no web address or query - or
the call is a `400`, and the app checks the same pattern before following it. Only 1.0.7
and later understand it, plus 1.0.6 once its over-the-air update has been applied; older
ones, and any broadcast without a link, just open the app.

`title` defaults to "Stockton Heath". If the count has changed since the dry run, step 3 is a
`409` that sends nothing and gives the new count. Dead tokens are pruned from both tables, as
for every other send. Repeating step 3 sends the message a second time, because nothing
remembers a broadcast. The payload has no `tweetId`, so tapping the notification never sets
the bridge closure banner.

Broadcasts reach people who signed up for bridge alerts and bin reminders, not for news, and
Apple's guideline 4.5.4 says pushes shouldn't be used for promotion without an explicit
opt-in. Keep them rare and informational - the NHS Dentists launch was a deliberate one-off.

### Database

Uses **Turso** (a hosted libSQL/SQLite service) via **Prisma** ORM. Its tables:

- `BridgeAlert` - each detected bridge closure tweet (tweetId, tweetText, postedAt, detectedAt)
- `BridgeSubscription` - Expo push tokens subscribed to bridge alerts
- `BinSubscription` - Expo push tokens subscribed to bin reminders, each paired with a UPRN
- `AppMeta` - simple key/value store; holds `lastBinNotificationDate` for reminder de-duplication, and `nhsDentists` (the last good NHS dentists list, as JSON) and `nhsDentistsHealth` (`ok`, `stale` or `degraded`) - see [NHS dentists](#nhs-dentists); and one `get-hits|<day>|<src>|<platform>|<via>` row per day and combination, each a running count of openings of the website's download link (see `POST /get-hits`)
- `NhsDentistChange` - one row each time a nearby dental practice's new-patient status changes between two daily reads of nhs.uk. A history only; nothing reads it yet. Created by `20260929000000_add_nhs_dentist_changes`
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

Applying one twice is a normal accident - there is no ledger to say what has run, so the
only record is memory. Every `CREATE TABLE`, `CREATE INDEX` and data-copy `INSERT` in these
files is therefore written to survive it: `IF NOT EXISTS` and `INSERT OR IGNORE`, so re-running
a whole file is a no-op rather than an error that stops it partway through. That last part is
the point - a bare `CREATE TABLE` that fails aborts the file, so a migration that also seeds
data would create nothing and seed nothing, but *look* like it had only failed the first step.

The exception is `ALTER TABLE ... ADD COLUMN`, in `20260825000000_add_subscription_period_fields`
and `20260826000000_add_listing_removed_at`. SQLite has no `IF NOT EXISTS` for it, so re-running
those two fails with `duplicate column name`. That error is harmless and means the column is
already there.

Nothing applies migrations automatically - the Dockerfile only runs `prisma generate && tsc`. (`backend/dbsetup.js` does call `prisma migrate deploy`, but it is a leftover from an abandoned Fly.io setup, is never copied into the image, and is never executed. It is misleading and worth deleting.)

Two historical notes: the original `PushToken` table was replaced by the two subscription tables in `20260601000000_replace_push_token_with_subscriptions`; and `AppMeta` was absent from the live database until August 2026, which meant bin reminders fell back to an in-memory guard and could double-send if the container restarted between 18:00 and 19:00 UK.

### Background Jobs

All scheduled with `setInterval` in `backend/src/index.ts` - there is no cron or job runner.

- **Bridge polling** (every 10 minutes, 6am-10pm UK time): checks twitterapi.io for new tweets from `@trafficwarr` containing "Swingbridge" (excluding test posts). If a new one is found, it saves it to the database and, if it was posted in the last 30 minutes, pushes to all bridge subscribers via the Expo Push Notification service.
- **Fuel price polling** (every 30 minutes): fetches fresh prices from the Gov.uk Fuel Finder API using OAuth client credentials. Results are cached in memory.
- **Weather polling** (every 10 minutes, `src/weather.ts`): reads OpenWeather's One Call API 3.0 for Stockton Heath and caches it in memory - 144 calls a day, well inside the 1,000 a day One Call 3.0 gives free, however many people open the app. A failed read keeps the last good one, but `/weather` stops serving it once it is an hour old: the app labels the weather LIVE.
- **NHS dentists** (checked hourly, runs once the saved list is a day old): reads the nhs.uk find-a-dentist results page, then each practice's appointments page five seconds apart - about four minutes in all. Saved to `AppMeta`, so a restart serves the saved list without reading nhs.uk again. A failed read is retried the next hour. See [NHS dentists](#nhs-dentists).
- **Bin reminders** (checked every minute, fires at 18:00 UK time): groups bin subscriptions by UPRN, queries the council API for each, and pushes "Put out your \<bins\> tonight" to anyone with a collection tomorrow. De-duplicated per day via `AppMeta` so a redeploy can't double-send.

Invalid Expo push tokens returned by the push service are pruned from the relevant subscription table automatically.

### NHS dentists

`backend/src/nhsDentists.ts` reads nhs.uk rather than the NHS Service Search API because
a production API key is not self-serve - it is requested from the national service desk
and reviewed by hand, and developers have reported waiting months for one. The website
also carries something the API does not: the date each practice last confirmed its
status. It is a plain `fetch` and `cheerio`, not a headless browser; the pages are
rendered on the server, and Chromium would not fit on the droplet.

Two kinds of page are read, once a day:

1. **The results page** for Stockton Heath (the lat/lon the weather uses). It lists the
   nearest 50 practices, which currently reach about 8 miles - comfortably past the 5-mile
   cut-off (`MAX_MILES`) - and gives the list, the
   phone numbers, the distances and a first guess at each status. Every field is read
   from an element id nhs.uk puts on each result (`item_id_N`, `orgname_N`,
   `not_accepting_patients_N`...) - the full list is at the top of the module.
2. **Each practice's appointments page**, five seconds apart as nhs.uk's `robots.txt`
   asks. This is the final word on status, because the results page shows the same
   block for "does not accept new NHS patients" and "has not confirmed whether it does".
   It also has the "Last confirmed" date. Specialist-only practices are skipped - their
   appointments page is a 404.

The new list is published in one go when the practice pages are done, so the app never
sees half of one sync and half of the next. It is also saved to `AppMeta` and loaded at
boot, so a deploy serves the saved list straight away and does not read nhs.uk again until
it is a day old. Only with no saved list at all - the very first boot - is the results page
alone served for those first few minutes.

**Comparing with yesterday.** Each sync is compared with the saved list. A practice that
starts taking a group it wasn't taking gets `opened: { at, groups }`, which the app shows as
"Newly taking adults 18 or over - spotted 26 Sep" for 14 days. Every change of status or
groups is also logged to `NhsDentistChange`, a history for later use (alerts, say). The
first sync has nothing to compare with, so records nothing.

**When nhs.uk changes its markup.** A results page with any practice the parser can't
fully read fails the whole sync, and the last good list is kept with its original
`fetchedAt` - which the app shows - rather than a guess. A practice page it can't read
falls back to the results page's status for that practice, or to yesterday's reading when
the results page shows the same groups as yesterday, so one failed request doesn't lose a
practice's "not confirmed" status or its date.

**You are emailed** (at `OWNER_EMAIL`, through the same Resend setup as Local Offers) when the list's
health changes, never once per failed attempt:

| Email | When |
|---|---|
| `nhsDentistsStale` | No successful read of the results page for 48 hours - two days of hourly retries |
| `nhsDentistsDegraded` | A read finished, but a practice page loaded and wasn't recognised, or more than a fifth of them failed to load. Lists each one |
| `nhsDentistsRecovered` | Back to normal after either of the above |

The state is saved in `AppMeta`, so a restart doesn't send the same email twice. The app
adds its own warning above the list once it is more than 3 days old.

Run this first:

```bash
cd backend
npx tsx scripts/check-nhs-dentists.ts           # what the parser makes of the live results page
npx tsx scripts/check-nhs-dentists.ts --pages   # and of every practice page (about 4 minutes)
```

The log also warns if the 50-result page stops reaching 5 miles, which would mean
practices at the edge are silently missing.

**Licence.** nhs.uk content is reusable, commercially too, under the Open Government
Licence v3.0, on three conditions the screen meets: it is credited as information from
the NHS website with the licence named, it is refreshed daily (at least every 7 days is
required, or an "as at" date shown - the screen shows when it was last checked), and no
NHS logo or branding is used. Keep all three if the screen is redesigned.

**The map.** nhs.uk gives no coordinates, so the backend places each practice by its
postcode, looked up on [postcodes.io](https://postcodes.io) - free, no key, one request
for the whole list, and positions are carried over between syncs so only a new practice
is ever looked up. A list saved before positions existed gets them at boot. A failed
lookup leaves a practice off the map but in the list, and the map says how many are
missing. postcodes.io serves the ONS Postcode Directory under the OGL, which asks for
the ONS, OS and Royal Mail credits in its About entry; the map screen names the source
and says pins are approximate.

The map is **MapLibre** (`@maplibre/maplibre-react-native`, `components/DentistMap.tsx`),
open source and the same on iOS and Android, drawing **OpenStreetMap** data served by
**OpenFreeMap** (`tiles.openfreemap.org/styles/liberty`): free, no API key, no account, no
billing. The pins are one circle layer coloured by status, not a view per pin. MapLibre
shows the "© OpenStreetMap" credit from the style itself - keep `attribution` on - and
OpenStreetMap is listed on About.

- **OpenFreeMap has no uptime promise** - it runs on donations. If it is down the map is
  blank and the list still works. Moving to another provider (MapTiler, Stadia, or tiles
  hosted on R2) is a change to `MAP_STYLE` alone.
- **It is native code**, so it only reaches phones through a store build, never
  `npm run ui-update`. That is why this change took the app to **1.0.6**: updates only
  reach builds with the same version, so 1.0.5 builds without the map library can't be
  sent JavaScript that needs it. The library's Expo plugin is in `app.json`.
- **The app does not use location, and says so.** MapLibre ships an optional "show my
  location" feature, and that code alone is enough for Apple's upload scan to demand a
  location purpose string - build 36 drew ITMS-90683 without one, and App Review can
  reject for it. So `app.json` carries `NSLocationWhenInUseUsageDescription`, saying the
  app doesn't use location. iOS only shows that text in the permission pop-up, which the
  app never triggers, so nobody sees it. MapLibre's Android manifest also adds
  `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION`; `android.blockedPermissions`
  strips them, so Play doesn't see an app asking for location it never uses. If "show my
  location" is ever wanted: rewrite the string to describe the real use, remove the two
  blocked permissions, and update Play's Data safety form.
- `DentistMap.web.tsx` is a stand-in so `expo start --web` still runs; the app is not
  published on the web.

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
- `.eas/workflows/ota-production.yml` does the same on Expo's servers (run it from expo.dev → Workflows). It reads the `EXPO_PUBLIC_*` values from the **production** EAS environment variables, since `eas update` does not read the build-profile env in `eas.json`. **Prefer `npm run ui-update` from a local checkout of `main`:** it publishes in about a minute, whereas we're on Expo's free plan and workflow jobs wait in the shared queue (~1 hour seen in September 2026)
- Push notifications are delivered via the **Expo Push Notification service**, which wraps APNs on iOS. EAS manages the APNs key, so iOS push needs nothing in the repo - unlike Android, see below

### Meta SDK (app install ads)

Added October 2026 so the app can be advertised with Meta's **App Promotion**
objective, one campaign per platform, instead of a traffic ad pointing at the
website's `/get` page. Meta app "Stockton Heath", App ID `1710831803797789`, in the
Zap Digital business portfolio, with the iOS and Google Play platforms added.

- **Set up by** the `react-native-fbsdk-next` plugin entry in `app.json`, plus
  `utils/metaSdk.ts`, which `app/_layout.tsx` calls once the first screen is up.
- **What it sends:** installs and app opens only, logged automatically
  (`autoLogAppEventsEnabled`). No custom events, no Facebook Login, nothing about
  what someone does in the app.
- **iPhone: Apple's "Allow tracking?" prompt, asked once.** Added before 1.0.9 because
  Apple's own App Privacy guidance counts an ad SDK that measures installs as
  tracking, and apps carrying Meta's SDK without the prompt have been rejected. The
  wording is the `expo-tracking-transparency` plugin entry in `app.json`, and
  deliberately doesn't mention Facebook or Instagram adverts. If someone
  allows it, `utils/metaSdk.ts` turns on advertiser ID collection so the IDFA goes to
  Meta; otherwise none is sent and Meta counts the install only through SKAdNetwork
  and its aggregated measurement (the plugin adds Meta's two SKAdNetwork IDs). This is
  re-checked every launch, so turning tracking off in iOS Settings takes effect on the
  next one. iOS starts the SDK at launch regardless, so on a first launch the install
  can reach Meta before the answer does.
- **Android: no advertising ID, no prompt.** `advertiserIDCollectionEnabled` is `false`
  and `com.google.android.gms.permission.AD_ID` is in `blockedPermissions` (both
  `react-native-fbsdk-next` and `expo-tracking-transparency` would otherwise add it), so
  the Play Console's Advertising ID declaration stays "No". Android installs are
  matched through the Play install referrer.
- The App ID and Client Token in the plugin entry come from developers.facebook.com
  (App settings → Basic, and → Advanced → Security). Neither is secret: both are
  compiled into the app.
- It is native code, so it ships in a store release, never with `npm run ui-update`.
- Declared, as of 28 October 2026:
  - **App Store App Privacy:** Coarse Location, Device ID and Product Interaction, each
    for Developer's Advertising or Marketing and Analytics, not linked to identity,
    used for tracking.
  - **Play Data safety:** Approximate location, App interactions and Device or other
    IDs, each collected and shared, required, for Analytics and Advertising or
    marketing; encrypted in transit; no accounts.
  - **The website's privacy policy** describes the same.
  Change what the SDK sends and all three need updating.

### Releasing a new store version

In Claude Code, `/release` (or asking Claude to release) runs this whole process from
`.claude/skills/release/SKILL.md`:
- it checks what has changed since the last store build
- it agrees the version number and the App Store "What's New" text with you
- it opens the version PR
- it starts the workflow once you've merged it and said "go"
- it follows the run and hands you the App Store steps

The steps below are what it follows.

`.eas/workflows/release.yml` builds both apps from one commit and sends each to its store.
Run it on `main` from expo.dev → Workflows, or with `npx eas-cli workflow:run release.yml`.

1. **Bump `version` in `app.json`** (1.0.7 → 1.0.8) and merge. Neither store takes a second
   release of a version that is already live. Build numbers look after themselves
   (`autoIncrement`, `appVersionSource: remote`).
2. **Run the workflow.** On the free plan the builds wait in Expo's queue, so allow an hour
   or two.
3. **Android needs nothing more.** The `production` submit profile in `eas.json` publishes to
   the production track with `releaseStatus: completed`, so it goes out to everyone once
   Google's review passes. EAS signs in to Play with the **Play Store submissions** Google
   service account key in EAS credentials (Android → Service Credentials) - a different
   slot from the FCM key described under Android below.
4. **iOS stops at App Store Connect.** Apple doesn't let EAS submit for review. Once the
   build has processed (15-30 minutes), add a new iOS version with the same number, paste
   the What's New text, pick the build and press Submit for Review. `ascAppId` in `eas.json`
   is the app's Apple ID, which lets EAS upload without asking questions.

Ship new features this way rather than with `ui-update`. A store update runs the new code
the first time the app opens, while an over-the-air update is only downloaded when the app
starts from closed and applied the start after that, which can take weeks for people who
never close it.

`runtimeVersion` uses the `appVersion` policy, so `npm run ui-update` only reaches phones on
the `version` currently in `app.json`. Once a bump is merged, over-the-air fixes stop reaching
the previous version - publish any it needs first.

### Android

`app.json` carries Android configuration (package name, adaptive icon, edge-to-edge).
Android builds and store releases go through `release.yml` with iOS - see
[Releasing a new store version](#releasing-a-new-store-version). The app is now live on
Play after the first submission was rejected.

`eas.json` sets `appVersionSource: "remote"` with `autoIncrement` on the production
profile, so EAS raises the Android `versionCode` itself. A resubmission needs a
production build, not a hand-edited `version` in `app.json`.

#### Push notifications on Android need FCM - two separate pieces

iOS push works with nothing in the repo because EAS handles the APNs key for you.
**Android does not.** Expo's push service talks to Firebase Cloud Messaging, and FCM
needs configuring on both sides:

1. **`google-services.json` at the repo root**, pointed at by
   `expo.android.googleServicesFile` in `app.json`. This is what lets the *app* register
   with FCM and obtain a push token. Download it from the Firebase console
   (Project settings → Your apps → Android app, package `com.mattbrierley1.stocktonheath`).
   It holds only public identifiers, so commit it - do not gitignore it.
2. **An FCM V1 service account key uploaded to EAS.** This is what lets the *backend's*
   pushes to `exp.host` reach the device. Firebase console → Project settings →
   Service accounts → Generate new private key, then `eas credentials` →
   `Android` → `production` → `Google Service Account`. This key is a secret and must
   never be committed.

Piece 1 was missing until September 2026 and Android push was dead in every build up
to and including 1.0.4 (versionCode 10). With no Firebase config the app has no
`google_app_id` resource, `FirebaseApp` never initialises, and
`Notifications.getExpoPushTokenAsync()` throws. `registerForPushNotifications` catches
it and returns a null token, so both the Bridge tab and bin reminders failed at the
"Enable notifications" button with a dialog and never reached the backend - no token was
stored, so nothing was sent to that device when a bridge alert fired. The one Android
user hit exactly this.

**This cannot be fixed by `npm run ui-update`.** `googleServicesFile` is consumed at
prebuild and compiled into the native app, so an over-the-air JS update will not carry
it. It takes a new production build and a Play submission.

`app.json` now names `./google-services.json`, so an Android build **will fail at
prebuild** until that file is present. That is deliberate - a loud failure beats
shipping a third build whose notification button cannot work.

#### Rejected by Google Play, September 2026 - Misleading Claims

Google rejected the first Android submission under the **Misleading Claims** policy:
*"Broken or Inaccessible Source Link"*. An app that shows government information has
to name its sources and link to them, and a reviewer clicks those links.

Two separate things were wrong.

**The store listing carried two dead URLs.** `https://www.warrington.gov.uklaunch` -
the word "launch" glued onto the host, most likely copied off a council page along
with the label of its link - and `fuel-finder.service.gov.uk`, which is missing its
`www` and does not resolve. Neither URL is in this repo. The listing text lives in
Play Console and is the owner's to fix.

**The app named its sources but linked none of them.** About listed "Gov.uk Fuel
Finder" and "Warrington Borough Council" as plain text, and the only statement that
the app is unofficial was in the store description, nowhere in the app. Google
flagged the in-app experience as a second area.

The app half is fixed:

- `utils/dataSources.ts` holds every source and its URL. About, Help, the bin days
  screen and the fuel prices screen all read from it, so a single screen cannot drift
  onto a dead link on its own.
- About opens with a disclaimer card - not affiliated, only reads what those bodies
  already publish, not a way to contact them - above the source list.
- Bin days, fuel prices and the bridge card each repeat the attribution where the
  data is actually shown, so it does not depend on anyone opening About.

**Before changing anything that touches a source link:**

- Check the URL returns 200 first. Every URL in `utils/dataSources.ts` was checked.
- Link a page someone can read, never an API endpoint. The Fuel Finder API host
  (`www.fuel-finder.service.gov.uk`) answers a browser with **403**, which reads as
  broken all over again - link the Fuel Finder collection page,
  `https://www.gov.uk/government/collections/fuel-finder`, instead. Not the old
  guidance page `/guidance/access-fuel-price-data`: GOV.UK withdrew it on 1 May 2026
  and it now renders a "withdrawn" banner, which a reviewer treats as a dead source.
  The council's bin page is `https://www.warrington.gov.uk/bins`.
- Credit the source the data actually comes from. Bridge alerts are read from the
  Traffic Warrington account on X (`https://x.com/trafficwarr`), a third-party feed,
  and About, Help and the Bridge tab all say so. Never attribute them to a council
  page they do not come from - a wrong attribution is the same policy breach.
- Nothing in the app may imply it is official, endorsed, or able to act on the
  council's behalf.

The resubmission is version **1.0.3**: build 8 and the rejected build 5 both read
1.0.2, which was ambiguous in correspondence with review. Still to do, not blocking:
an in-app privacy policy link. Play's App content declarations are complete, but the
app sends push tokens and a UPRN to the backend, and Play's User Data policy expects a
link inside the app as well as on the listing.

#### Rejected again, October 2026 - Missing Source Link for Government Information

1.0.7 (versionCode 13) was rejected under the same policy, this time as *"Missing
Source Link for Government Information"*. The cause was NHS Dentists, which shows NHS
information. Google named two places, and both lacked an NHS link:

- **The store listing.** Its "OFFICIAL SOURCES" list had no NHS entry, and the
  description didn't mention the dentists feature. The owner added both in Play
  Console.
- **The app.** The screen's only NHS link was at the foot of the list, under every
  practice. A "Source: nhs.uk" line now sits under the subtitle, visible without
  scrolling, in both the list and map views.

Every new data source therefore needs three things: an entry in
`utils/dataSources.ts`, a link on the screen's first view, and a line in the
listing's "OFFICIAL SOURCES". The `/release` skill checks for all three.

### Environment Variables

**Frontend**

The backend URL is committed into `eas.json` per build profile, so EAS builds pick it up without a local `.env`. A local `.env` with the same key is needed for `expo start`:

- `EXPO_PUBLIC_BACKEND_URL` - Backend base URL (`https://stocktonheath.duckdns.org`)

Note that `EXPO_PUBLIC_*` variables are inlined into the client bundle at build time and are therefore readable by anyone with the app - they are not secrets. That is why the OpenWeather key moved to the backend in October 2026: as `EXPO_PUBLIC_OPENWEATHER_API_KEY` anyone could read it out of the app and spend it. Copies of the app from before then still call OpenWeather directly with that key, so the backend has a key of its own and the old one can be deleted in OpenWeather once those copies have updated - they then show "Weather is unavailable" until they do.

**Backend (`backend/.env`)**

- `DATABASE_URL` - Turso libSQL URL
- `TURSO_AUTH_TOKEN` - Turso authentication token
- `TWITTERAPI_IO_API_KEY` - API key for twitterapi.io (used to read tweets)
- `ADMIN_TOKEN` - shared secret for the admin-only routes above. Generate with `openssl rand -hex 32`. Without it those routes return `503`.
- `FUEL_FINDER_CLIENT_ID` / `FUEL_FINDER_CLIENT_SECRET` - Gov.uk Fuel Finder OAuth credentials
- `OPENWEATHER_API_KEY` - OpenWeather key with the One Call API 3.0 subscription. Without it `/weather` returns `503`, which is logged once; nothing else is affected

Local Offers (all optional - each route returns `503` until the variables it needs are set). As of 16 October 2026 everything, R2 included, is configured on the droplet, with Stripe in live mode and Clerk on its production instance:

- `CLERK_SECRET_KEY` - Clerk backend API key; verifies portal session tokens and reads the signed-in business's email address
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - signing secret for `POST /stripe/webhook`
- `STRIPE_PRICE_ID` - the £20/month recurring price (VAT is added on top by `STRIPE_TAX_RATE_ID`)
- `LOCAL_OFFERS_LAUNCH_AT` - **optional.** An ISO date-time that moves the launch, e.g.
  `2026-11-06T00:00:00Z` to put it back a week. Unset means 30 October 2026, written in
  `src/launch.ts`. An unreadable value is logged and ignored, never thrown
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
  event list. The buyer's half comes from Checkout, which requires a billing address and
  offers Stripe's "purchasing as a business" box for the business name and VAT number
  (optional, since a business that isn't VAT registered can't reclaim the VAT anyway).
  Stripe prints all three on every invoice the subscription raises.
- `PORTAL_BASE_URL` - the portal's base URL, currently `https://stockton-heath-support.vercel.app/business`, moving to `https://www.stocktonheathapp.com/business` with Clerk production (which will not run on `*.vercel.app`). `www`, not the bare domain: Vercel redirects `stocktonheathapp.com` to `www`, so that is the origin browsers send and CORS must match. May carry a path: Stripe's redirect URLs are built from the whole value, while CORS compares against its origin alone.
- `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` - Cloudflare R2 credentials for listing images
- `R2_PUBLIC_URL` - base URL images are served from

Notification email (optional - with none of it set, nothing is sent and every request still
succeeds; failures are logged, never returned to the caller).

Sent through **Resend's HTTP API**, as `Stockton Heath <info@stocktonheathapp.com>`, not
SMTP. DigitalOcean blocks outbound SMTP on every droplet (ports 25, 465 and 587) and
declined to lift it, so neither nodemailer nor the IONOS mailbox can send from the droplet.
Resend's records are on the domain at IONOS (DKIM at `resend._domainkey`, and the `send`
subdomain's MX and SPF for bounces, sending region Ireland); the domain's own MX, SPF and
DMARC are IONOS's and untouched, so `info@` still receives at IONOS and replies land there.
Until October 2026 mail went through the Gmail API from `stocktonheathapp@gmail.com`, which
is no longer used anywhere - it forwards to `info@` for the copies of the app that still show it.

- `RESEND_API_KEY` - a **sending-only** Resend key restricted to `stocktonheathapp.com`.
  Without it nothing is sent, which is logged once.
- `OWNER_EMAIL` - where "needs approving" and "new subscriber" notices go, and the account
  allowed to approve from the portal UI: the owner's Clerk login address and this must match.
  `info@stocktonheathapp.com`.
- `MAIL_FROM` - optional sender, defaults to `Stockton Heath <info@stocktonheathapp.com>`. Its
  domain must be the one verified in Resend. Written without quotes in `backend/.env`, like
  every value there.

Sends are retried on network errors, Resend server errors and per-second rate limits, with
one idempotency key across the attempts, so a retry can't deliver twice. Emails a Stripe
webhook sends (`subscriptionStarted`, `freeMonthEndingUnapproved`, `invoicePaid`) are keyed
on the Stripe event id: Stripe redelivers an event when the answer is slow or lost, and
Resend drops the repeat for 24 hours. Each successful send logs Resend's email id, which
finds it in Resend's dashboard.

---

### Every email a business can get

Deliberately short. Anything that only confirms what the page in front of them already
says has been taken out - "We've got your discount" used to go out the moment someone
saved one, which told them nothing and trained them to skim the rest.

| When | Template |
|---|---|
| They sign up | `welcomeUser` |
| Their subscription starts | `subscriptionStarted` |
| Every payment | `invoicePaid` (the VAT invoice) |
| A day later, still not paying | `subscriptionReminder`, once ever |
| Their discount goes live | `listingApproved` |
| They change anything residents see on an approved listing | `listingUpdated` |
| An admin removes their listing | `listingRemoved` |

Before launch, none of these says a discount is "live": the approved ones say when
discounts open instead, and a subscription that starts with the free month says when the
first payment is rather than thanking anyone for one.

The last three are event-driven and are not optional extras: `listingApproved` is the
email `subscriptionStarted` promises ("we'll email you as soon as yours is live"),
`listingUpdated` explains why a live discount has come out of the app, and
`listingRemoved` is the only thing that tells someone their listing has gone.

The owner gets four emails of their own: `userSignedUp`, copies inside `listingUpdated` and
`subscriptionStarted`, and `freeMonthEndingUnapproved` - sent when Stripe's
`customer.subscription.trial_will_end` arrives (three days before a free month ends) for a
listing nobody has approved, so it can be approved or removed before its first payment
is taken. Saving a discount sends nothing to anybody.

### Reminding a business that hasn't subscribed

An hourly sweep (`remindUnpaidListings`) emails anyone whose discount is at least 24 hours
old, isn't active, and has never had a Stripe subscription - once, ever. A lapsed business
is deliberately excluded: they did subscribe, so "start your subscription" tells their story
wrong.

`RemindedListing` records who has been sent it; the insert is the lock, so the sweep can run
as often as it likes. The migration that creates the table **seeds it with every listing that
already exists**, so applying it can't blast a backlog of old signups. Only listings written
after that point are ever nudged - to nudge an older one deliberately, delete its row.

The sweep is not run at boot, so a redeploy is a quiet event rather than one that sends mail.

## Before going live

Everything below is the owner's to do by hand - dashboards and environment
variables, not code. The code for all of it is written and merged; it sits
switched off until these are done, which is deliberate.

### VAT (added August 2026, switched on 16 October 2026)

The price is advertised as £20 excluding VAT, so Stripe adds 20% and every
payment produces a VAT invoice. **Decided October 2026: launch at £20 plus VAT.**
Do these in Stripe's live mode, as part of switching to it - tax rates are
separate per mode. Nothing happens until all five of these are done, and doing
them in the wrong order is worse than not starting:

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

- **Stripe has been live since 16 October 2026**, in the Zap Digital account
  (`acct_1U7eLsAYotNwImtB`; Stripe is used for nothing else). Price
  `price_1URDIyAYotNwImtBCpRy88h3` (£20/month, tax exclusive), tax rate
  `txr_1URDHEAYotNwImtB5y37MZph` (UK VAT 20%, exclusive), webhook
  `we_1URDYpAYotNwImtBnWxtMAAN` on API version `2026-07-29.dahlia` - the version
  the backend's Stripe library uses, and the payload shape `invoice.paid` is read
  in. Stripe's own emails are on for failed payments, payment confirmation (3D
  Secure), trial ending and expiring cards, because the backend sends none of
  those; its receipt and finalised-invoice emails are off, because the backend
  sends the invoice. A renewal that fails every retry cancels the subscription.
  Checkout, invoices and bank statements say Zap Digital, not Stockton Heath.
  The values in `backend/.env` are written `NAME=value` with no quotes: Docker's
  `--env-file` keeps quotes as part of the value, and a name pasted twice
  (`NAME=NAME=value`) gave a key Stripe rejected without logging it.
- **Clerk production has been live since 13 October 2026** for
  `stocktonheathapp.com` (password minimum 8, email confirmed by a code,
  CAPTCHA, paths under `/business`), with the portal on
  `https://www.stocktonheathapp.com/business` and `PORTAL_BASE_URL` set to
  match. The publishable key (Vercel) and secret key (droplet) must always be
  from the same instance - one without the other breaks every login. **Sign-up
  has been open since 18 October 2026** (invitation-only before): businesses
  are emailed a link to the business page and sign up with whichever address
  they want, since the one found for a business online isn't necessarily it.
  Nothing reaches residents without approval and a subscription. Accounts made
  on the old development instance did not carry over.
- **Photo upload works**, served from a `pub-...r2.dev` address, with the
  portal's `www` origin in the bucket's CORS `PUT` rule - the browser uploads
  straight to R2, so without it every upload fails and nothing in the logs
  explains why. A custom domain for `R2_PUBLIC_URL` would avoid `r2.dev`'s
  rate limits, but Cloudflare only attaches one when it also runs the
  domain's DNS, which is at IONOS - so it waits until after launch; at this
  app's traffic `r2.dev` is fine.
- **The portal is at `https://www.stocktonheathapp.com/business`** (domain
  bought at IONOS, on Vercel since 13 October 2026): Clerk production refuses
  `*.vercel.app`.
- **The webhook's event list** needs `customer.subscription.trial_will_end`
  as well as `invoice.paid`.

---

## Monetisation

The app currently carries a single hardcoded sponsor:

- `components/SponsorCard.tsx` - a full "About our sponsor" card on the Home tab
- `components/SponsorBadge.tsx` - a compact "sponsored by" strip on the Services and Bridge tabs

Both reference Rowswood Timber directly, including the logo asset. Changing sponsor currently means editing the components and shipping a build.

### Local Offers

The replacement for the hardcoded sponsor: local businesses pay **£20/month plus VAT** by Stripe subscription to advertise a **genuine discount** to residents - the editorial rule that keeps the feature useful rather than just advertising. Businesses are emailed a link to the portal, sign themselves up, write their own listing and pay for it.

The portal is a small React app that does not exist yet. It will live in the **`stockton-heath-support`** repo, served at `https://stockton-heath-support.vercel.app/business` - not a separate repository, as originally planned.

- **Authentication** is handled by **Clerk** - it owns sign-up, passwords and password resets, so no credential reaches this backend. The portal sends a Clerk session token as a bearer token and `requireBusinessAuth` verifies it. Sign-up is open: a signed-in caller with no listing is an expected state rather than an error, and creating one is the next thing they do. A listing is owned by the Clerk account that created it (`clerkUserId` is unique, so one account means one listing), and its contact address is read from that account rather than the request body.
- **Every listing carries a category**, one of eight defined by
  `LISTING_CATEGORIES` in `backend/src/index.ts` and mirrored in the portal's
  `listingFields.ts`. Stored as the label rather than a code, because SQLite
  has no enum type and the backend refuses anything off the list anyway. It is
  required to create a listing, and changing it does **not** send the listing
  back for review - it is cataloguing, not a claim a resident acts on. Rows
  written before the column existed were backfilled to `Other`.
- **The owner can re-file a listing** from the portal's Listings page, where
  the category cell is a dropdown that saves on change
  (`POST /business-listings/:id/category`). It **emails nobody**: being moved
  to Home & Garden is not news a business can act on, and if they disagree
  they can set it back from their own page. Its own route rather than a reuse
  of `PATCH /me`, which sends `listingUpdated` unconditionally - that shortcut
  is exactly what would send the email this must not send.
- **Nothing a stranger signs up for is visible.** A listing reaches the app only once it is approved and paid, so an unwanted sign-up costs no more than a row in the pending queue.
- **Billing** is Stripe Checkout in subscription mode. `customer.subscription.*` webhooks are the single source of truth for `active`, so cancelling from the portal and cancelling from Stripe's own Customer Portal behave identically. The cancel route sets `cancel_at_period_end` and deliberately does not touch `active` itself.
- **Checkout opts out of Stripe Managed Payments** (`managed_payments: { enabled: false }`). That is Stripe's merchant-of-record product, enabled by default on the account: it adds 3.5% per transaction, requires a product tax code, and would make Stripe rather than the app's owner the party selling advertising. Without opting out, checkout fails outright. It is set in code rather than the dashboard so the decision travels with the repository. The parameter is newer than `stripe@22`'s types, so the params type is extended locally.
- **The webhook needs the raw request body.** `express.raw` is mounted on `/stripe/webhook` above the global `express.json()`; body-parser marks the request as already read, so the JSON parser leaves that one path alone.
- **Images** are uploaded directly to Cloudflare R2 via a short-lived signed URL; the portal PATCHes the resulting public URL back once the upload succeeds. The browser shrinks the picture to 1200px and re-encodes it as JPEG first, which keeps residents off 5MB downloads, sidesteps HEIC (which iPhones produce, the backend rejects and React Native won't render), and drops the EXIF block - which is where the GPS coordinates of somebody's home live. Sending an empty `imageUrl` clears the photo; anything else must start with `R2_PUBLIC_URL`, so the field cannot be pointed at another host. **The old file is deleted from R2 whenever the photo is replaced, cleared, or the listing is removed** - which includes deleting a user, where leaving the picture up would make the erasure untrue. The delete happens after the row is written, never throws, and only ever targets a key derived from a URL that starts with `R2_PUBLIC_URL`.
- **Any edit residents would see resets `approved` to `false`** - the business name, the discount, the description and the photo (`REVIEWED_FIELDS`). Every listing is read before it goes live, and that has to stay true after an edit: the description is where an offer's terms go, and a terms change unread is an unread offer. The cost is that a typo fix takes a live listing out of the app until it is approved again. Until October 2026 only the discount and photo did this.
- **A new account is welcomed on its first authenticated request**, because Clerk owns sign-up and never tells this backend it happened. `requireBusinessAuth` only looks for a `WelcomedUser` row when the caller has **no listing** - anyone with one was welcomed long ago - so the extra lookup is paid by new signups and very little else. The insert is the lock: whoever creates the row sends the emails, so two requests arriving together cannot both send. The Clerk lookup happens before the insert, so a Clerk failure leaves no row and the next request tries again rather than marking someone welcomed having sent nothing. The owner gets a row but no email.
- **Deleting a user is an erasure, and looks their listing up by email as well as Clerk id.** The two normally agree, but a Clerk account deleted and remade with the same address leaves a row pointing at the old id - and `contactEmail` is unique, so a row matched by neither would hold that address for ever with no login left to reach it. It deletes their Stripe customer too, found by email rather than by the row's `stripeCustomerId`, so a listing removed on its own doesn't strand one. Stripe first, then the row, then the account: every step is safe to repeat, so a failure part-way is retried by pressing Delete again. Invoices and charges survive at Stripe on purpose - they are financial records and not ours to throw away.
- **An admin has two ways to take a listing down, and they are deliberately different.** Unapproving hides it while it carries on paying, and is undone with one click - that is the one to reach for. Removing it (`/remove`) cancels the subscription **there and then** rather than at the end of the period, because a business should not be charged for a month no resident can see; it then deletes the row outright, which frees the business's email and Clerk id, so signing in afterwards looks exactly like the first visit ever did, and emails the business to say their discount is out of the app and their subscription is stopped. Not undoable from the portal. Deleting a user goes through the same route, so the two can't drift apart.
- All Local Offers config is read lazily. A missing variable returns `503` from the affected route rather than throwing at boot, because `deploy:backend` removes the running container before starting the new one - a boot-time throw would take weather, fuel, bridge alerts and bin reminders down with it.
- **CORS** is scoped to `PORTAL_BASE_URL` and compares against its **origin**, since a browser's `Origin` header never carries a path and `PORTAL_BASE_URL` does. The mobile app sends no `Origin` header and is unaffected, as are all the pre-existing routes.

#### Launch and the free month

Discounts open in the app on **30 October 2026**, and anyone who starts their
subscription before then pays nothing until **30 November 2026**. Both dates are in
`backend/src/launch.ts`, as UK midnight (00:00 UTC - the clocks go back on 25 October).

- **The launch switch is the public route.** `GET /business-listings` returns `[]` until
  launch however much is approved and paid, so nothing has to ship on the day. The app
  shows its Discounts tab only once that list is non-empty (`hooks/useDiscountsLive.ts`),
  which also stops the page ever appearing empty. `LOCAL_OFFERS_LAUNCH_AT` moves the date without a code
  change - set it on the droplet and `npm run deploy:backend`.
- **The free month is a fixed `trial_end`, not a 30-day trial,** or early sign-ups would
  be billed before the month residents can see. Checkout adds it to any session created
  before launch ("signing up before launch" means starting the subscription before it).
  After launch, Checkout charges straight away. Stripe refuses a `trial_end` less than 48
  hours away, so a launch postponed past 28 November would stop offering it.
- Checkout still takes the card, so the first payment happens on 30 November without the
  business coming back; `trial_settings` cancels rather than leaves owing if one is
  somehow missing. `trialing` counts as paid (`PAID_SUBSCRIPTION_STATUSES`), so a listing
  in its free month is `active`.
- **Cancelling in the free month costs nothing:** the cancel route sets
  `cancel_at_period_end`, and during a trial the period ends at `trial_end`, so Stripe
  ends the subscription without raising an invoice.
- Every renewal after that falls on the 30th (the 28th in February).
- **An unapproved listing in its free month will be charged on 30 November.** The
  `trial_will_end` email warns the owner three days before. Approve it, or remove it -
  removing cancels the subscription immediately, so nothing is charged.

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
| Public route the app reads | working; returns the approved, paid listings |
| Clerk sign-up, login, listing creation | working; sign-ups are **open**, not invitation-only |
| Stripe checkout and webhook | configured and paid end to end in a **sandbox** (test mode) |
| Cloudflare R2 image upload | **not configured** - the routes return `503` |
| The business portal | built, in `mfbrierley/stockton-heath-support` |
| The app's Discounts tab | built, and **hidden on the `production` channel** until it is signed off - see below |

Stripe went live on 16 October 2026 - see "Also outstanding" under "Before going live" for the account and its ids.

---

## Tech Stack Summary

| Layer                | Technology                                                                          |
| -------------------- | ----------------------------------------------------------------------------------- |
| Mobile app           | Expo SDK 54, React Native, TypeScript                                               |
| Routing              | Expo Router (file-based)                                                            |
| State / data         | React hooks, AsyncStorage for local caching                                         |
| Backend              | Node.js 22, Express 5, TypeScript                                                   |
| Database             | Turso (libSQL/SQLite) via Prisma 7                                                  |
| Push notifications   | Expo Push Notification service (APNs on iOS, FCM on Android)                        |
| Containerisation     | Docker                                                                              |
| Hosting              | DigitalOcean Droplet                                                                |
| Build / distribution | EAS Build, EAS Submit, EAS Update, App Store                                        |
| Business auth        | Clerk (`@clerk/backend`)                                                            |
| Payments             | Stripe (Checkout, Customer Portal, subscription webhooks)                           |
| Image storage        | Cloudflare R2 (signed uploads via the S3-compatible API)                             |
| External APIs        | OpenWeather One Call, twitterapi.io, Gov.uk Fuel Finder, Warrington Borough Council, postcodes.io |
| Scraped pages        | nhs.uk find-a-dentist (parsed with `cheerio`)                                        |
| Maps                 | MapLibre React Native with OpenStreetMap tiles from OpenFreeMap (no API key)        |

---

## Location Context

Stockton Heath is a village suburb of Warrington in Cheshire, England. Key local landmarks referenced in the app:

- **Latchford Swing Bridge** - a road bridge over the Manchester Ship Canal that closes periodically, causing disruption; the bridge alerts feature monitors this
- **Broomfields Leisure Centre** - local council-run sports and fitness facility
- **Medical centres** - Stockton Heath, Latchford and Stretton surgeries
- **Stockton Heath Post Office** - local post office on London Road
- **Household Waste Recycling Centres** - Lymm Road (Thelwall) and Woolston
- Local petrol stations: ASDA Wilderspool Causeway, ESSO Latchford, Morrisons Stockton Heath
