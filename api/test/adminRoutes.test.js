const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const adminAuth = {};
const locketAuthVerifier = {
  async verifyIdToken(token) {
    if (token === "verified-admin") {
      return { uid: "admin-user", email: "admin@example.test" };
    }
    if (token === "verified-admin-email") {
      return { uid: "rotated-admin-user", email: "admin@example.test" };
    }
    return { uid: "regular-user", email: "user@example.test" };
  },
};

process.env.ADMIN_LOCKET_UIDS = "admin-user";

const firebaseServicePath = require.resolve("../src/services/adminFirebase");
require.cache[firebaseServicePath] = {
  id: firebaseServicePath,
  filename: firebaseServicePath,
  loaded: true,
  exports: {
    ADMIN_FIREBASE_PROJECT_ID: "woww-7720f",
    getAdminAuth: () => adminAuth,
    getInitializationError: () => null,
  },
};

const verifierServicePath = require.resolve("../src/services/locketAdminVerifier");
require.cache[verifierServicePath] = {
  id: verifierServicePath,
  filename: verifierServicePath,
  loaded: true,
  exports: {
    getAdminLocketEmails: () => new Set(["admin@example.test"]),
    getAdminLocketUids: () => new Set(["admin-user"]),
    getLocketAuthVerifier: () => locketAuthVerifier,
  },
};

const activityStorePath = require.resolve("../src/services/userActivityStore");
require.cache[activityStorePath] = {
  id: activityStorePath,
  filename: activityStorePath,
  loaded: true,
  exports: {
    clearLoginHistory: async () => 0,
    getLoginHistory: async () => [],
    getWebUser: async () => null,
    hasActivityDatabase: () => true,
    listWebUsers: async () => ({
      users: [{
        uid: "admin-user",
        email: "admin@example.test",
        auth_provider: "password",
        login_method: "email",
        account_status: "active",
        created_at: "2026-08-01T00:00:00.000Z",
        last_login_at: "2026-08-01T01:00:00.000Z",
        last_seen_at: "2026-08-01T01:05:00.000Z",
        current_web_source: "vercel",
        active_sessions: 1,
        latest_login_event_at: "2026-08-01T01:00:00.000Z",
        ip_address: "203.0.113.9",
        country: "VN",
        region: "HN",
        city: "Hà Nội",
        browser: "Chrome",
        browser_version: "126.0",
        os: "Windows",
        device: "Desktop",
        latest_login_method: "email",
        latest_web_source: "vercel",
        web_version: "Beta1.3.6",
        build_id: "test-build",
        commit_hash: "abcdef12",
      }],
      total: 1,
      nextOffset: null,
      onlineWindowSeconds: 150,
    }),
    setAccountStatus: async () => true,
    writeAudit: async () => {},
  },
};

const adminRoutes = require("../src/routes/adminRoutes");

let server;
let baseUrl;

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("admin endpoints reject requests without a Locket token", async () => {
  const response = await fetch(`${baseUrl}/api/admin/verify`);
  assert.equal(response.status, 401);
});

test("a verified regular user receives 403 without UID disclosure", async () => {
  const response = await fetch(`${baseUrl}/api/admin/verify`, {
    headers: { Authorization: "Bearer verified-regular-user" },
  });
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.error, "Admin permission required");
  assert.equal(JSON.stringify(body).includes("regular-user"), false);
});

test("the allowlisted Locket UID is accepted", async () => {
  const response = await fetch(`${baseUrl}/api/admin/verify`, {
    headers: { Authorization: "Bearer verified-admin" },
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.isAdmin, true);
  assert.equal(body.projectId, "woww-7720f");
});

test("the signed allowlisted email is accepted when the Locket UID changed", async () => {
  const response = await fetch(`${baseUrl}/api/admin/verify`, {
    headers: { Authorization: "Bearer verified-admin-email" },
  });
  assert.equal(response.status, 200);
});

test("the admin user list returns the latest login IP, location and browser version", async () => {
  const response = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Authorization: "Bearer verified-admin" },
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.users.length, 1);
  assert.equal(body.totalUsers, 1);
  assert.deepEqual(body.users[0].latestLoginData, {
    created_at: "2026-08-01T01:00:00.000Z",
    ip_address: "203.0.113.9",
    country: "VN",
    region: "HN",
    city: "Hà Nội",
    browser: "Chrome",
    browser_version: "126.0",
    os: "Windows",
    device: "Desktop",
    login_method: "email",
    web_source: "vercel",
    web_version: "Beta1.3.6",
    build_id: "test-build",
    commit_hash: "abcdef12",
  });
});
