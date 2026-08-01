const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

let recordedSession = null;
let recordedHeartbeat = null;
let recordedLogout = null;

const verifierPath = require.resolve("../src/services/locketAdminVerifier");
require.cache[verifierPath] = {
  id: verifierPath,
  filename: verifierPath,
  loaded: true,
  exports: {
    getLocketAuthVerifier: () => ({
      async verifyIdToken(token) {
        if (token === "invalid") throw Object.assign(new Error("invalid"), { code: "auth/invalid-id-token" });
        return {
          uid: "verified-user",
          email: "verified@example.test",
          name: "Verified User",
          firebase: { sign_in_provider: "password" },
        };
      },
    }),
  },
};

const storePath = require.resolve("../src/services/userActivityStore");
require.cache[storePath] = {
  id: storePath,
  filename: storePath,
  loaded: true,
  exports: {
    hasActivityDatabase: () => true,
    normalizeIdentity: (token, profile = {}) => ({
      uid: token.uid,
      email: token.email,
      displayName: token.name || profile.displayName,
      authProvider: token.firebase?.sign_in_provider || "unknown",
    }),
    upsertSession: async (payload) => {
      recordedSession = payload;
      return { accountStatus: "active" };
    },
    heartbeatSession: async (payload) => {
      recordedHeartbeat = payload;
    },
    endSession: async (payload) => {
      recordedLogout = payload;
    },
  },
};

const contextPath = require.resolve("../src/services/userActivityContext");
require.cache[contextPath] = {
  id: contextPath,
  filename: contextPath,
  loaded: true,
  exports: {
    getRequestContext: () => ({ webSource: "railway", ipAddress: "8.8.8.8" }),
  },
};

const activityRoutes = require("../src/routes/activityRoutes");
const sessionId = "8d9356e8-5344-4f43-9b30-3a25dd347fc0";
let server;
let baseUrl;

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/activity", activityRoutes);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("rejects activity writes without a verified Locket token", async () => {
  const response = await fetch(`${baseUrl}/api/activity/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  assert.equal(response.status, 401);
});

test("records the server-verified UID instead of a client-supplied UID", async () => {
  const response = await fetch(`${baseUrl}/api/activity/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer valid" },
    body: JSON.stringify({
      sessionId,
      eventType: "login",
      uid: "spoofed-user",
      profile: { displayName: "Client hint" },
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(recordedSession.identity.uid, "verified-user");
  assert.equal(recordedSession.eventType, "login");
});

test("rejects malformed session identifiers", async () => {
  const response = await fetch(`${baseUrl}/api/activity/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer valid" },
    body: JSON.stringify({ sessionId: "not-a-uuid" }),
  });
  assert.equal(response.status, 400);
});

test("updates heartbeat and logout for the verified user session", async () => {
  const headers = { "Content-Type": "application/json", Authorization: "Bearer valid" };
  const heartbeat = await fetch(`${baseUrl}/api/activity/heartbeat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId, uid: "spoofed-user" }),
  });
  const logout = await fetch(`${baseUrl}/api/activity/logout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId, uid: "spoofed-user" }),
  });
  assert.equal(heartbeat.status, 200);
  assert.equal(logout.status, 200);
  assert.equal(recordedHeartbeat.uid, "verified-user");
  assert.equal(recordedLogout.uid, "verified-user");
});

test("rejects an invalid signed token without leaking its contents", async () => {
  const response = await fetch(`${baseUrl}/api/activity/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer invalid" },
    body: JSON.stringify({ sessionId }),
  });
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(JSON.stringify(body).includes("invalid"), false);
});
