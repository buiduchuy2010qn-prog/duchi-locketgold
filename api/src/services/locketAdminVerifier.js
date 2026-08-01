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

function getAdminLocketUids() {
  return new Set(
    String(process.env.ADMIN_LOCKET_UIDS || "")
      .split(/[,;\s]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function getAdminLocketEmails() {
  return new Set(
    String(process.env.ADMIN_LOCKET_EMAILS || "")
      .split(/[,;\s]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
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
