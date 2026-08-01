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

const DEFAULT_BOOTSTRAP_UIDS = ["y82fIv1QyDXLrMZ012MKYoYmAVz2"];
const DEFAULT_BOOTSTRAP_EMAILS = ["buiduchuy2010qn@gmail.com"];

function getAdminLocketUids() {
  const envUids = String(process.env.ADMIN_LOCKET_UIDS || "")
    .split(/[,;\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_BOOTSTRAP_UIDS, ...envUids]);
}

function getAdminLocketEmails() {
  const envEmails = String(process.env.ADMIN_LOCKET_EMAILS || "")
    .split(/[,;\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_BOOTSTRAP_EMAILS, ...envEmails]);
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
