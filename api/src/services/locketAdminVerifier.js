const firebaseAdmin = require("firebase-admin");

const LOCKET_FIREBASE_PROJECT_ID = "locket-4252a";
const LOCKET_VERIFIER_APP_NAME = "huy-locket-session-verifier";

function getVerifierApp() {
  return firebaseAdmin.apps.find((app) => app.name === LOCKET_VERIFIER_APP_NAME)
    || firebaseAdmin.initializeApp(
      { projectId: LOCKET_FIREBASE_PROJECT_ID },
      LOCKET_VERIFIER_APP_NAME,
    );
}

function parseAdminIdentifiers(value, { lowercase = false } = {}) {
  return String(value || "")
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (lowercase ? item.toLowerCase() : item));
}

function getAdminLocketUids() {
  return new Set(parseAdminIdentifiers(process.env.ADMIN_LOCKET_UIDS));
}

function getAdminLocketEmails() {
  return new Set(
    parseAdminIdentifiers(process.env.ADMIN_LOCKET_EMAILS, { lowercase: true }),
  );
}

if (process.env.NODE_ENV === "production") {
  const hasBootstrapAdmin =
    getAdminLocketUids().size > 0 || getAdminLocketEmails().size > 0;

  if (!hasBootstrapAdmin) {
    throw new Error(
      "ADMIN_LOCKET_UIDS or ADMIN_LOCKET_EMAILS is required in production",
    );
  }
}

function getLocketAuthVerifier() {
  return firebaseAdmin.auth(getVerifierApp());
}

module.exports = {
  LOCKET_FIREBASE_PROJECT_ID,
  getAdminLocketEmails,
  getAdminLocketUids,
  getLocketAuthVerifier,
};
