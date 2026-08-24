#!/usr/bin/env node

// Verifies the Local Offers backend end to end against real Clerk and Stripe,
// without needing the business portal to exist.
//
// It creates a throwaway Clerk user and mints a session token for it - the
// same kind of token the portal will send - so the whole self-serve path can
// be walked from a script: sign up, create a listing, get reviewed, pay.
//
//   cd backend
//   BACKEND_URL=https://stocktonheath.duckdns.org \
//   ADMIN_TOKEN=... CLERK_SECRET_KEY=sk_test_... \
//   node scripts/verify-local-offers.mjs
//
// Deletes the Clerk user it creates, and prints the one command needed to
// remove the test listing row.

import { createClerkClient } from "@clerk/backend";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const TEST_EMAIL = process.env.VERIFY_EMAIL ?? "local-offers-verify@example.com";

if (!ADMIN_TOKEN || !CLERK_SECRET_KEY) {
  console.error("Set ADMIN_TOKEN and CLERK_SECRET_KEY before running this.");
  process.exit(1);
}

let passed = 0;
let failed = 0;
let skipped = 0;

const pass = (msg) => { passed++; console.log(`  PASS  ${msg}`); };
const fail = (msg) => { failed++; console.log(`  FAIL  ${msg}`); };
const skip = (msg) => { skipped++; console.log(`  SKIP  ${msg}`); };
const check = (ok, msg) => (ok ? pass(msg) : fail(msg));

const api = async (path, { method = "GET", token, admin, body } = {}) => {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (admin) headers["x-admin-token"] = ADMIN_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, json, text };
};

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

let listingId = null;
let clerkUserId = null;

try {
  console.log(`\nVerifying ${BACKEND_URL}\n`);

  console.log("Existing routes");
  check((await api("/health")).status === 200, "GET /health");
  check((await api("/bridge-alerts")).status === 200, "GET /bridge-alerts");

  console.log("\nPublic route");
  const publicBefore = await api("/business-listings");
  check(publicBefore.status === 200 && Array.isArray(publicBefore.json),
    "GET /business-listings returns a list");

  // ── A business signs itself up ──────────────────────────────────────────────
  console.log("\nSign-up (real Clerk session token)");
  let jwt;
  try {
    const user = await clerk.users.createUser({
      emailAddress: [TEST_EMAIL],
      password: `Vf-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      skipPasswordChecks: true,
    });
    clerkUserId = user.id;
    const session = await clerk.sessions.createSession({ userId: clerkUserId });
    const tokenResult = await clerk.sessions.getToken(session.id);
    jwt = typeof tokenResult === "string" ? tokenResult : tokenResult?.jwt;
  } catch (error) {
    fail("could not create a Clerk test user - is CLERK_SECRET_KEY correct, and does it match the app you configured?");
    throw error;
  }
  check(Boolean(jwt), "minted a Clerk session token");

  check((await api("/business-listings/me")).status === 401, "GET /me rejects no token");
  check((await api("/business-listings/me", { token: "not-a-real-token" })).status === 401,
    "GET /me rejects a bogus token");

  const beforeCreating = await api("/business-listings/me", { token: jwt });
  check(beforeCreating.status === 404,
    "a signed-in business with no listing yet gets 404, not a refusal");

  // ── It creates its own listing ──────────────────────────────────────────────
  console.log("\nCreating a listing");
  check((await api("/business-listings/me", {
    method: "POST", token: jwt, body: { businessName: "Verification Test Business" },
  })).status === 400, "creation requires a discount, not just a name");

  const created = await api("/business-listings/me", {
    method: "POST",
    token: jwt,
    body: {
      businessName: "Verification Test Business",
      discountText: "10% off for residents",
      description: "A listing created by the verification script.",
    },
  });
  // A listing row from an earlier run blocks this one, because contactEmail is
  // unique. Bail out with the cleanup command rather than letting every later
  // check fail for want of a listing.
  if (created.status === 409) {
    fail(`a listing for ${TEST_EMAIL} is left over from a previous run`);
    console.log(`\n  Remove it and run this again:\n    turso db shell stockton-heath "DELETE FROM BusinessListing WHERE contactEmail='${TEST_EMAIL}';"`);
    throw new Error("stale test listing from a previous run");
  }

  check(created.status === 201, `POST /me creates the listing (${created.status})`);
  listingId = created.json?.id ?? null;
  check(created.json?.contactEmail === TEST_EMAIL,
    "contact address is taken from the Clerk account, not the request body");

  check((await api("/business-listings/me", {
    method: "POST", token: jwt,
    body: { businessName: "Second", discountText: "x", description: "y" },
  })).status === 409, "a business cannot create a second listing");

  // ── Review ──────────────────────────────────────────────────────────────────
  console.log("\nReview");
  const pending = await api("/business-listings/pending", { admin: true });
  check(pending.status === 200 && pending.json?.some((l) => l.id === listingId),
    "the new listing appears in the pending queue");
  check((await api("/business-listings/pending")).status === 401,
    "the pending queue rejects a missing admin token");

  check((await api(`/business-listings/${listingId}/approve`, { method: "POST", admin: true })).status === 200,
    "approve");

  const afterApprove = await api("/business-listings");
  check(!afterApprove.json?.some((l) => l.id === listingId),
    "approved but unpaid listing stays hidden from the app");

  // ── Editing rules ───────────────────────────────────────────────────────────
  console.log("\nEditing");
  const descEdit = await api("/business-listings/me", {
    method: "PATCH", token: jwt, body: { description: "A description edit." },
  });
  check(descEdit.status === 200 && descEdit.json?.approved === true,
    "editing the description keeps approval (a typo fix can't pull a paying listing)");

  const discountEdit = await api("/business-listings/me", {
    method: "PATCH", token: jwt, body: { discountText: "15% off for residents" },
  });
  check(discountEdit.status === 200 && discountEdit.json?.approved === false,
    "editing the discount resets approval for re-review");

  check((await api("/business-listings/me", { method: "PATCH", token: jwt, body: { discountText: "" } })).status === 400,
    "PATCH rejects an empty discount");
  check((await api("/business-listings/me", { method: "PATCH", token: jwt, body: { imageUrl: "https://evil.example.com/x.png" } })).status === 400,
    "PATCH rejects an image URL from another host");

  // ── Paying ──────────────────────────────────────────────────────────────────
  console.log("\nStripe");
  const checkout = await api("/business-listings/me/checkout", { method: "POST", token: jwt });
  if (checkout.status === 503) {
    skip("checkout - Stripe not configured on the server yet");
  } else {
    check(checkout.status === 200 && typeof checkout.json?.url === "string" && checkout.json.url.includes("stripe.com"),
      `POST /me/checkout returns a Stripe Checkout URL (${checkout.status})`);
    if (checkout.json?.url) console.log(`        ${checkout.json.url.slice(0, 78)}...`);
  }
  check((await api("/business-listings/me/cancel", { method: "POST", token: jwt })).status === 409,
    "cancel refuses when there is no subscription yet");

  console.log("\nImage upload");
  const upload = await api("/business-listings/me/image-upload-url", {
    method: "POST", token: jwt, body: { contentType: "image/png" },
  });
  if (upload.status === 503) {
    skip("image upload - R2 not configured on the server yet");
  } else {
    check(upload.status === 200 && typeof upload.json?.uploadUrl === "string",
      `POST /me/image-upload-url returns a signed URL (${upload.status})`);
  }
  check((await api("/business-listings/me/image-upload-url", {
    method: "POST", token: jwt, body: { contentType: "application/pdf" },
  })).status === 400, "image upload rejects a non-image type");
} catch (error) {
  if (!(error instanceof Error && error.message === "stale test listing from a previous run")) {
    fail(`stopped early: ${error instanceof Error ? error.message : error}`);
  }
} finally {
  console.log("\nCleanup");
  if (clerkUserId) {
    try {
      await clerk.users.deleteUser(clerkUserId);
      pass("deleted the throwaway Clerk user");
    } catch {
      fail(`could not delete Clerk user ${clerkUserId} - remove it in the dashboard`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (listingId) {
    console.log(`\nRemove the test listing with:\n  turso db shell stockton-heath "DELETE FROM BusinessListing WHERE contactEmail='${TEST_EMAIL}';"`);
  }
  process.exit(failed > 0 ? 1 : 0);
}
