#!/usr/bin/env node

// One-off: turns a Google OAuth client into the refresh token the backend
// needs to send mail through the Gmail API.
//
// Run it on your own machine, not the droplet - it opens a browser page for
// you to approve, and listens on localhost to catch the answer.
//
//   cd backend
//   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/get-gmail-refresh-token.mjs
//
// Before running, in the Google Cloud console:
//   1. Create a project (any name)
//   2. APIs & Services -> Library -> enable "Gmail API"
//   3. APIs & Services -> OAuth consent screen -> External, add the Gmail
//      address as a test user, then PUBLISH the app. Left in "Testing" the
//      refresh token expires after 7 days.
//   4. Credentials -> Create credentials -> OAuth client ID -> Desktop app
//   5. Copy the client ID and secret into the command above
//
// It prints a refresh token. That plus the client id and secret go in the
// droplet's backend/.env. The token does not expire on its own, but Google
// revokes it if the account password is reset - rerun this if mail stops.

import { createServer } from "node:http";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = Number(process.env.PORT ?? 8765);
const REDIRECT = `http://localhost:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/gmail.send";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running this.",
  );
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    // Both are needed: offline asks for a refresh token at all, and consent
    // forces a fresh one even if this account has approved before.
    access_type: "offline",
    prompt: "consent",
  });

const exchange = async (code) => {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Google said ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.end(`Refused: ${error}. You can close this tab.`);
    console.error(`\nGoogle refused: ${error}`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.end("Waiting for the authorisation code.");
    return;
  }

  try {
    const tokens = await exchange(code);
    res.end("Done. You can close this tab and go back to the terminal.");

    if (!tokens.refresh_token) {
      console.error(
        "\nGoogle returned no refresh token. That usually means this account " +
          "has approved before - revoke access at " +
          "https://myaccount.google.com/permissions and run this again.",
      );
      server.close();
      process.exit(1);
    }

    console.log("\nAdd these three lines to the droplet's backend/.env:\n");
    console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log("\nKeep the refresh token secret - it can send mail as you.");
  } catch (failure) {
    res.end("Something went wrong. Check the terminal.");
    console.error(`\n${failure.message}`);
    server.close();
    process.exit(1);
  }

  server.close();
  process.exit(0);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Open this in your browser, and approve access:\n");
  console.log(authUrl);
  console.log(
    "\nGoogle will warn the app isn't verified - that's expected for one you " +
      "made yourself. Choose Advanced, then continue.\nWaiting...",
  );
});
