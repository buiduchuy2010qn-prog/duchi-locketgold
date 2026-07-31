import admin from "../../../../_utils/firebaseAdmin.js";
import { verifyAdmin, auditLog } from "../../../../_utils/auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { uid: adminUid } = await verifyAdmin(req);
    const targetUid = req.query.uid;

    if (!targetUid) {
      return res.status(400).json({ success: false, error: "Missing target uid" });
    }

    await admin.auth().updateUser(targetUid, { disabled: false });
    await auditLog(adminUid, "UNLOCK_USER", targetUid, "User account enabled");

    return res.status(200).json({ success: true, message: "User unlocked successfully" });
  } catch (error) {
    console.error("Unlock user error:", error);
    if (error.message.startsWith("Forbidden")) {
      return res.status(403).json({ success: false, error: "Not an admin" });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
}
