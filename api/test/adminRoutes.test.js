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
    getAdminLocketUids: () => new Set(["admin-user"]),
    getLocketAuthVerifier: () => locketAuthVerifier,
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
