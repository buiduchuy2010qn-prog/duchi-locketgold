import admin from "./firebaseAdmin.js";
import { sql } from "./db.js";

const SUPER_ADMIN_EMAIL = "buiduchuy2010qn@gmail.com";

export async function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const idToken = authHeader.split("Bearer ")[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    throw new Error("Unauthorized: " + error.message);
  }

  const uid = decodedToken.uid;
  const email = decodedToken.email;

  // Cấp quyền cứng cho Super Admin dựa vào email
  let isAdmin = false;
  if (email === SUPER_ADMIN_EMAIL) {
    isAdmin = true;
    
    // Ghi vào bảng admin_roles nếu chưa có
    if (sql) {
      await sql`
        INSERT INTO admin_roles (uid, email) 
        VALUES (${uid}, ${email})
        ON CONFLICT (uid) DO NOTHING;
      `;
    }
  } else {
    // Nếu không phải email gốc, check DB
    if (sql) {
      const rows = await sql`SELECT uid FROM admin_roles WHERE uid = ${uid}`;
      if (rows.length > 0) {
        isAdmin = true;
      }
    }
  }

  if (!isAdmin) {
    throw new Error("Forbidden: Not an admin");
  }

  return { uid, email };
}

export async function auditLog(adminUid, action, targetUid, details) {
  if (!sql) return;
  await sql`
    INSERT INTO admin_audit_log (admin_uid, action, target_uid, details)
    VALUES (${adminUid}, ${action}, ${targetUid}, ${details});
  `;
}
