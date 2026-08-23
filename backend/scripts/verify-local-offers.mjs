#!/usr/bin/env node

// Verifies the Local Offers backend end to end against real Clerk and Stripe,
// without needing the business portal to exist.
//
// It creates a throwaway Clerk user and mints a session token for it, which is
// the same kind of token the portal will send, so every JWT-gated route can be
// exercised from a script.
//
//   cd backend
//   BACKEND_URL=https://stocktonheath.duckdns.org \
//   ADMIN_TOKEN=... CLERK_SECRET_KEY=sk_test_... \
//   node scripts/verify-local-offers.mjs
//
// Cleans up the Clerk user it creates. Prints the one command needed to remove
// the test listing row at the end.

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

  // ── The existing app keeps working ──────────────────────────────────────────
  console.log("Existing routes");
  check((await api("/health")).status === 200, "GET /health");
  check((await api("/bridge-alerts")).status === 200, "GET /bridge-alerts");

  // ── Public route ────────────────────────────────────────────────────────────
  console.log("\nPublic route");
  const publicBefore = await api("/business-listings");
  check(publicBefore.status === 200 && Array.isArray(publicBefore.json), "GET /business-listings returns a list");

  // ── Admin ───────────────────────────────────────────────────────────────────
  console.log("\nAdmin routes");
  const noAuth = await fetch(`${BACKEND_URL}/business-listings`, { method: "POST" });
  check(noAuth.status === 401, "POST /business-listings rejects a missing admin token");

  const created = await api("/business-listings", {
    method: "POST",
    admin: true,
    body: { businessName: "Verification Test Business", contactEmail: TEST_EMAIL },
  });
  if (created.status === 409) {
    fail(`a listing for ${TEST_EMAIL} already exists - remove it and re-run (see cleanup below)`);
    throw new Error("stale test listing");
  }
  check(created.status === 201, `POST /business-listings creates a listing (${created.status})`);
  listingId = created.json?.id ?? null;
  check(
    created.json?.invitationSent === true,
    created.json?.invitationSent === true
      ? "Clerk invitation sent"
      : "Clerk invitation FAILED - check CLERK_SECRET_KEY and PORTAL_BASE_URL on the server",
  );

  const pending = await api("/business-listings/pending", { admin: true });
  check(
    pending.status === 200 && pending.json?.some((l) => l.id === listingId),
    "GET /business-listings/pending shows it awaiting approval",
  );

  check((await api(`/business-listings/${listingId}/approve`, { method: "POST", admin: true })).status === 200,
    "POST approve");

  const afterApprove = await api("/business-listings");
  check(
    !afterApprove.json?.some((l) => l.id === listingId),
    "approved but unpaid listing stays hidden from the app",
  );

  // ── Business auth via a real Clerk session token ────────────────────────────
  console.log("\nBusiness routes (real Clerk session token)");
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

  const me = await api("/business-listings/me", { token: jwt });
  check(me.status === 200, `GET /me with a real token (${me.status})`);
  check(me.json?.businessName === "Verification Test Business",
    "GET /me returns the listing linked by invited email address");
  check(me.json?.stripeCustomerId === undefined && me.json?.clerkUserId === undefined,
    "GET /me omits internal identifiers");

  const descEdit = await api("/business-listings/me", {
    method: "PATCH", token: jwt, body: { description: "A description edit." },
  });
  check(descEdit.status === 200 && descEdit.json?.approved === true,
    "editing the description keeps approval (a typo fix can't pull a paying listing)");

  const discountEdit = await api("/business-listings/me", {
    method: "PATCH", token: jwt, body: { discountText: "10% off for residents" },
  });
  check(discountEdit.status === 200 && discountEdit.json?.approved === false,
    "editing the discount resets approval for re-review");

  check((await api("/business-listings/me", { method: "PATCH", token: jwt, body: { discountText: "" } })).status === 400,
    "PATCH rejects an empty discount");
  check((await api("/business-listings/me", { method: "PATCH", token: jwt, body: { imageUrl: "https://evil.example.com/x.png" } })).status === 400,
    "PATCH rejects an image URL from another host");

  // ── Stripe ──────────────────────────────────────────────────────────────────
  console.log("\nStripe");
  const checkout = await api("/business-listings/me/checkout", { method: "POST", token: jwt });
  if (checkout.status === 503) {
    skip("checkout - Stripe not configured on the server yet");
  } else {
    check(checkout.status === 200 && typeof checkout.json?.url === "string" && checkout.json.url.includes("stripe.com"),
      `POST /me/checkout returns a Stripe Checkout URL (${checkout.status})`);
    if (checkout.json?.url) console.log(`        ${checkout.json.url.slice(0, 78)}...`);
  }

  const cancel = await api("/business-listings/me/cancel", { method: "POST", token: jwt });
  check(cancel.status === 409, "cancel refuses when there is no subscription yet");

  // ── R2 ──────────────────────────────────────────────────────────────────────
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
  fail(`stopped early: ${error instanceof Error ? error.message : error}`);
} finally {
  // ── Cleanup ─────────────────────────────────────────────────────────────────
  console.log("\nCleanup");
  if (clerkUserId) {
    try {
      await clerk.users.deleteUser(clerkUserId);
      pass("deleted the throwaway Clerk user");
    } catch (error) {
      fail(`could not delete Clerk user ${clerkUserId} - remove it in the dashboard`);
    }
  }
  try {
    const invites = await clerk.invitations.getInvitationList({ query: TEST_EMAIL, status: "pending" });
    for (const invite of invites.data ?? []) await clerk.invitations.revokeInvitation(invite.id);
  } catch { /* nothing to revoke */ }

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (listingId) {
    console.log(`\nRemove the test listing with:\n  turso db shell stockton-heath "DELETE FROM BusinessListing WHERE contactEmail='${TEST_EMAIL}';"`);
  }
  process.exit(failed > 0 ? 1 : 0);
}
