const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (serviceAccountBase64) {
      const serviceAccountJson = Buffer.from(serviceAccountBase64, "base64").toString("utf-8");
      const serviceAccount = JSON.parse(serviceAccountJson);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT_BASE64 is missing for adminRoutes.");
    }
  } catch (error) {
    console.error("Firebase admin initialization error", error);
  }
}
const { neon } = require('@neondatabase/serverless');

function getDatabaseUrl() {
  const candidates = [process.env.DATABASE_URL, process.env.NEON_DATABASE_URL];
  for (const raw of candidates) {
    if (raw && typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
  }
  return null;
}

const dbUrl = getDatabaseUrl();
const sql = dbUrl ? neon(dbUrl) : null;



let firstRun = true;

// Middleware to verify admin
async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Missing or invalid Authorization header" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken, true);
  } catch (error) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const uid = decodedToken.uid;
  const email = decodedToken.email;
  let isAdmin = false;

  if (decodedToken.admin === true) {
    isAdmin = true;
  } else if ((process.env.ADMIN_BOOTSTRAP_UID && uid === process.env.ADMIN_BOOTSTRAP_UID) || email === 'buiduchuy2010qn@gmail.com') {
    try {
      await admin.auth().setCustomUserClaims(uid, { admin: true });
      isAdmin = true;
    } catch (err) {
      console.error("Failed to set custom claim during bootstrap:", err);
    }
  } else if (firstRun) {
    // Tự động cấp quyền cho người đầu tiên truy cập sau khi server khởi động
    try {
      firstRun = false;
      await admin.auth().setCustomUserClaims(uid, { admin: true });
      isAdmin = true;
      console.log(`[BOOTSTRAP] Auto-granted admin to UID: ${uid}`);
    } catch (err) {
      console.error("Failed to set custom claim for firstRun:", err);
    }
  } else {
    // Tự động cấp quyền nếu username là ducchuy2010
    try {
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(uid).get();
      if (userDoc.exists) {
        const username = userDoc.data().username;
        if (username === 'ducchuy2010' || username === '@ducchuy2010' || uid === 'H8qQ92PZ4N' || userDoc.data().email === 'buiduchuy2010qn@gmail.com') { // fallback conditions
          await admin.auth().setCustomUserClaims(uid, { admin: true });
          isAdmin = true;
        }
      }
    } catch (err) {
      console.error("Failed to verify username from Firestore", err.message);
    }
  }

  if (!isAdmin && sql) {
    try {
      const rows = await sql`SELECT uid FROM admin_roles WHERE uid = ${uid}`;
      if (rows.length > 0) {
        isAdmin = true;
      }
    } catch (err) {
      console.error("Failed to verify DB admin roles:", err);
    }
  }

  if (!isAdmin) {
    return res.status(403).json({ success: false, error: `Bạn không có quyền quản trị viên hệ thống. UID của bạn là: ${uid}` });
  }

  req.adminUid = uid;
  req.adminEmail = email;
  next();
}

async function auditLog(adminUid, action, targetUid, details) {
  if (!sql) return;
  try {
    await sql`
      INSERT INTO admin_audit_log (admin_uid, action, target_uid, details)
      VALUES (${adminUid}, ${action}, ${targetUid}, ${details});
    `;
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

router.get('/verify', requireAdmin, (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).json({ 
    success: true, 
    uid: req.adminUid, 
    email: req.adminEmail,
    isAdmin: true 
  });
});

router.get('/users', requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const maxResults = parseInt(req.query.limit) || 50;
    const pageToken = req.query.pageToken || undefined;
    const search = req.query.search || "";

    const listUsersResult = await admin.auth().listUsers(maxResults, pageToken);
    
    let users = listUsersResult.users.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      photoURL: u.photoURL,
      disabled: u.disabled,
      creationTime: u.metadata.creationTime,
      lastSignInTime: u.metadata.lastSignInTime,
      provider: u.providerData.length > 0 ? u.providerData[0].providerId : 'custom'
    }));

    if (search) {
      const lowerSearch = search.toLowerCase();
      users = users.filter(u => 
        (u.email && u.email.toLowerCase().includes(lowerSearch)) || 
        (u.displayName && u.displayName.toLowerCase().includes(lowerSearch)) ||
        u.uid.toLowerCase().includes(lowerSearch)
      );
    }

    const uids = users.map(u => u.uid);
    let loginData = [];
    if (sql && uids.length > 0) {
      try {
        loginData = await sql`
          SELECT DISTINCT ON (uid) uid, ip_address, country, city, browser, os, device, created_at
          FROM login_history
          WHERE uid = ANY(${uids})
          ORDER BY uid, created_at DESC
        `;
      } catch (e) {
        console.error("DB query failed", e);
      }
    }

    const historyMap = {};
    loginData.forEach(l => {
      historyMap[l.uid] = l;
    });

    users = users.map(u => ({
      ...u,
      latestLoginData: historyMap[u.uid] || null
    }));

    await auditLog(req.adminUid, "LIST_USERS", null, "Listed users");

    return res.status(200).json({ 
      success: true, 
      users,
      pageToken: listUsersResult.pageToken
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.delete('/users/:uid/auth', requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const targetUid = req.params.uid;
    if (!targetUid) return res.status(400).json({ success: false, error: "Bad Request" });
    if (req.adminUid === targetUid) return res.status(403).json({ success: false, error: "Cannot delete yourself" });

    await admin.auth().deleteUser(targetUid);
    await auditLog(req.adminUid, "DELETE_AUTH", targetUid, "User Auth deleted");

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post('/users/:uid/lock', requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const targetUid = req.params.uid;
    if (!targetUid) return res.status(400).json({ success: false, error: "Bad Request" });
    if (req.adminUid === targetUid) return res.status(403).json({ success: false, error: "Cannot lock yourself" });

    await admin.auth().updateUser(targetUid, { disabled: true });
    await admin.auth().revokeRefreshTokens(targetUid);
    await auditLog(req.adminUid, "LOCK_USER", targetUid, "User locked");

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post('/users/:uid/unlock', requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const targetUid = req.params.uid;
    if (!targetUid) return res.status(400).json({ success: false, error: "Bad Request" });

    await admin.auth().updateUser(targetUid, { disabled: false });
    await auditLog(req.adminUid, "UNLOCK_USER", targetUid, "User unlocked");

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
