import admin from "./firebaseAdmin.js";
import { sql } from "./db.js";

export async function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const idToken = authHeader.split("Bearer ")[1];
  let decodedToken;
  try {
    // Flag `true` bắt buộc Firebase check token thu hồi (revoked/disabled)
    decodedToken = await admin.auth().verifyIdToken(idToken, true);
  } catch (error) {
    throw new Error("Unauthorized");
  }

  const uid = decodedToken.uid;
  const email = decodedToken.email;

  let isAdmin = false;

  // 1. Ưu tiên kiểm tra Custom Claim `admin: true`
  if (decodedToken.admin === true) {
    isAdmin = true;
  } 
  // 2. Cơ chế Bootstrap Server-only: Nếu chưa có claim nhưng trùng khớp với ADMIN_BOOTSTRAP_UID hoặc là email của Admin (buiduchuy2010qn@gmail.com)
  else if ((process.env.ADMIN_BOOTSTRAP_UID && uid === process.env.ADMIN_BOOTSTRAP_UID) || email === 'buiduchuy2010qn@gmail.com') {
    try {
      await admin.auth().setCustomUserClaims(uid, { admin: true });
      isAdmin = true;
    } catch (err) {
      console.error("Failed to set custom claim during bootstrap:", err);
    }
  }

  // 3. Fallback: Nếu không dùng Firebase custom claims, check DB thật (admin_roles)
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
    throw new Error("Forbidden");
  }

  return { uid, email };
}

export async function auditLog(adminUid, action, targetUid, details) {
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
