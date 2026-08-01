const firebaseAdmin = require("firebase-admin");

const ADMIN_FIREBASE_APP_NAME = "huy-locket-admin";
const ADMIN_FIREBASE_PROJECT_ID = "woww-7720f";

let initializationError = null;

function getExistingApp() {
  return firebaseAdmin.apps.find((app) => app.name === ADMIN_FIREBASE_APP_NAME) || null;
}

function initializeAdminFirebase() {
  const existing = getExistingApp();
  if (existing) return existing;
  if (initializationError) return null;

  try {
    const encodedCredential = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!encodedCredential) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not configured");
    }

    const credentialJson = Buffer.from(encodedCredential, "base64").toString("utf8");
    const serviceAccount = JSON.parse(credentialJson);
    if (serviceAccount.project_id !== ADMIN_FIREBASE_PROJECT_ID) {
      throw new Error("Firebase service account belongs to a different project");
    }

    return firebaseAdmin.initializeApp(
      { credential: firebaseAdmin.credential.cert(serviceAccount) },
      ADMIN_FIREBASE_APP_NAME,
    );
  } catch (error) {
    initializationError = error;
    console.error("Admin Firebase initialization failed:", error.message);
    return null;
  }
}

function getAdminAuth() {
  const app = initializeAdminFirebase();
  return app ? firebaseAdmin.auth(app) : null;
}

function getInitializationError() {
  return initializationError;
}

module.exports = {
  ADMIN_FIREBASE_PROJECT_ID,
  getAdminAuth,
  getInitializationError,
};
