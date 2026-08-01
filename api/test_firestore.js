require('dotenv').config();
const admin = require('firebase-admin');
try {
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!serviceAccountBase64) {
    console.error("No FIREBASE_SERVICE_ACCOUNT_BASE64 found in .env");
    process.exit(1);
  }
  const serviceAccountJson = Buffer.from(serviceAccountBase64, "base64").toString("utf-8");
  const serviceAccount = JSON.parse(serviceAccountJson);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  const db = admin.firestore();
  db.collection("users").limit(10).get().then(snap => {
    snap.forEach(doc => {
      console.log(`UID: ${doc.id}, Username: ${doc.data().username}`);
    });
    process.exit(0);
  }).catch(err => {
    console.error("Firestore error:", err);
    process.exit(1);
  });
} catch (e) {
  console.error(e);
}
