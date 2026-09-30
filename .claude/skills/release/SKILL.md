---
name: release
description: Release a new version of the Stockton Heath app to the App Store and Google Play - version PR, EAS release workflow, then App Store submission. Use when the user asks to release, ship or publish a new version to the stores.
argument-hint: "[version, e.g. 1.1.0]"
---

# Release a new store version

Version asked for (blank means raise the last number): $ARGUMENTS

## Rules for the whole release

- **Start the release workflow only once the version PR is merged and the user has said "go" in this conversation.** It publishes Android to everyone as soon as Google's review passes, and that can't be undone.
- Never wait with `sleep`. Schedule a check-in (`send_later` in cloud sessions) or tell the user when to come back.
- Never edit `ios.buildNumber` or `android.versionCode`. EAS raises build numbers itself (`appVersionSource: remote`, `autoIncrement`).
- Builds use the code on GitHub `main`, so local or unmerged changes aren't in them.
- Keep messages to the user short and plain.

## Facts

- EAS project ID `99721d3f-5cda-481a-bf9d-f4a170ea4c95`, bundle ID and package `com.mattbrierley1.stocktonheath`, App Store Apple ID `6763075468`.
- `.eas/workflows/release.yml` builds iOS and Android from one commit:
  - **iOS:** uploaded to App Store Connect, where it stops. Apple doesn't let EAS submit for review.
  - **Android:** published to the production track (`releaseStatus: completed` in `eas.json`).
- On the free plan, iOS builds and uploads in about 10 minutes. Android can wait one to two hours in Expo's queue.
- Every iOS upload lands in TestFlight first, so Apple emails "ready to test". That email is expected.

## 1. Check there's something to release

1. If the working tree has uncommitted changes, stop and ask. Otherwise `git fetch origin main`.
2. Find the last release: the newest finished production store builds. Use the Expo connector's `build_list` for the project ID, or `npx eas-cli build:list --status finished --distribution store --limit 4 --json --non-interactive`. Note each platform's version, build number and `gitCommitHash`, and take the newest `gitCommitHash` as the last release.
3. List what has changed: `git log --first-parent --format='%h %s%n%b' <that commit>..origin/main`. Merge commits carry the PR title on their second line. If nothing a resident would notice has changed, say so and stop.
4. Look for two risky kinds of change since that commit:
   - **Native changes**, such as new or upgraded native packages in `package.json`, or plugins and permissions in `app.json`.
     - These only reach phones through a store release, so they make this release necessary.
     - A new permission needs its iOS purpose string, or an entry in `android.blockedPermissions`.
     - It may also need new App Privacy answers (Apple) and Data safety answers (Google).
   - **New data sources.** Each one must be credited and linked through `utils/dataSources.ts`. Google Play has rejected the app over this before; see "Rejected by Google Play" in `PROJECT_CONTEXT.md`.
5. Check the current version is live. `curl -s "https://itunes.apple.com/lookup?bundleId=com.mattbrierley1.stocktonheath&country=gb"` gives the live App Store `version`, which can lag a few hours. If `app.json`'s version isn't live yet (still in review, or rejected), stop and ask whether to wait or release anyway.

## 2. Agree the version and the What's New text

- **Version:** the one asked for above, if given. Otherwise take `app.json`'s `version` and raise the last number by one (1.0.7 → 1.0.8). It must be higher than the live App Store version.
- **What's New:**
  - one to four short lines for residents, in British English, most useful first
  - no PR numbers, internal names or version numbers
  - end with "Bug fixes and improvements." only if there were fixes
- Show the user the version, the What's New text and a short list of what's included. Wait for them to confirm or edit it.

## 3. Open the version PR

1. Use the branch your session was assigned, restarting it from `origin/main` if its last PR is merged. Otherwise create `release/<version>` from `origin/main`.
2. Change only `"version"` in `app.json`. Check that `npx expo config --type public --json` reads the new version.
3. Commit as "Release <version>" and open a PR with the same title. In the body, put the What's New text, the PRs included, and a line saying that merging doesn't start the release.
4. Ask the user to merge it, then say "go".
   - Explain that once it's merged, `npm run ui-update` from `main` only reaches the new version, which nobody has yet.
   - So any over-the-air fix for the current version has to be published before merging.

## 4. Start the release (after the merge and "go")

1. `git fetch origin main`, then run three checks so nothing is released twice:
   - `app.json` on `origin/main` has the new version.
   - `build_list` shows no finished store build of that version.
   - `workflow_list` shows no release run already in progress.
2. Start it with the Expo connector's `workflow_run` (project ID, `fileName: release.yml`, `gitRef: main`). Without the connector, run `npx eas-cli workflow:run release.yml` from an up-to-date checkout of `main`.
3. Check the run's commit is the head of `origin/main`.
4. Tell the user it has started, with the run ID and what happens next. Schedule a check-in about 15 minutes out.

## 5. Follow the run

On each check-in, read the run with `workflow_info`. For any failed job, read its logs with `workflow_logs`. Once iOS has succeeded, check back about every 45 minutes until Android is through.

Known failures:

| Job | Error | Fix |
| - | - | - |
| Publish on Google Play | Permission error or 403 | 1. In Play Console → Users and permissions, give `eas-submit@stockton-heath-android.iam.gserviceaccount.com` release permissions for the app. A brand-new key can take a while to start working.<br>2. Resubmit the finished build with `build_submit` (the build ID, `ANDROID`, track `production`). Don't rebuild. |
| Either submit job | Version already used or closed | That version number is taken. Open a new version PR with a higher number. |
| Upload to App Store Connect | Authentication | Check the App Store Connect API key in EAS credentials (iOS → `com.mattbrierley1.stocktonheath`) and `ascAppId` in `eas.json`. |
| A build | Anything | Read the logs, fix the cause in a PR, and re-run the workflow. A new build number is fine. |

Within about 30 minutes of the iOS upload, Apple may email about automated problems, such as a missing purpose string (ITMS-90683). Ask the user to pass on any App Store Connect email other than the TestFlight one.

## 6. Submit iOS for review

Once `submit_ios` has succeeded and the TestFlight email has arrived, give the user these steps with the values filled in:

1. In App Store Connect, go to Apps → Stockton Heath. Press **+** next to iOS App in the left sidebar, enter `<version>` and press Create.
2. Paste the What's New text.
3. Under Build, press Add Build, choose `<version> (<build>)` and press Done.
4. Leave "Automatically release this version" selected. Press Save, then Add for Review, then Submit to App Review.

Also offer this prompt for Claude for Chrome, filled in:

```
Submit version <version> of my iPhone app "Stockton Heath" for App Review.

1. Open https://appstoreconnect.apple.com/apps and choose Stockton Heath.
2. Press + next to "iOS App" in the left sidebar and create version <version>. If it already exists, open it instead.
3. In "What's New in This Version", paste exactly:
<What's New text>
4. Under Build, press Add Build and choose <version> (<build>). If it isn't listed, stop and tell me - it may still be processing.
5. Under App Store Version Release, choose "Automatically release this version".
6. Leave everything else as it is. If Apple asks anything else, answer as for the previous version, and if you're unsure, stop and ask me.
7. Press Save, then Add for Review. Before the final "Submit to App Review" click, show me a summary and wait for my OK.
8. Tell me the status shown afterwards. It should say "Waiting for Review".
```

## 7. Wrap up

Tell the user:
- the version and build numbers
- where each store has got to: Apple's review usually takes 1-2 days and Google's takes hours to a few days, and both go live by themselves
- that `npm run ui-update` now only reaches the new version
- that a broadcast `link` to a screen added in this release sends older app versions to a "not found" page. Send one only once this version is live on both stores and about a week has passed (see "Sending a broadcast" in `PROJECT_CONTEXT.md`).
