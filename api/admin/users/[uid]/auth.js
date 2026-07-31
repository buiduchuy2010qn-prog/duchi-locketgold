import admin from "../../../../_utils/firebaseAdmin.js";
import { verifyAdmin, auditLog } from "../../../../_utils/auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { uid: adminUid } = await verifyAdmin(req);
    const targetUid = req.query.uid;

    if (!targetUid) {
      return res.status(400).json({ success: false, error: "Missing target uid" });
    }

    if (adminUid === targetUid) {
      return res.status(403).json({ success: false, error: "Cannot delete yourself" });
    }

    // Chỉ xóa Auth, không đụng vào Firestore/Database theo yêu cầu user
    await admin.auth().deleteUser(targetUid);
    
    await auditLog(adminUid, "DELETE_AUTH", targetUid, "User Auth record permanently deleted");

    return res.status(200).json({ success: true, message: "User Auth deleted successfully" });
  } catch (error) {
    console.error("Delete auth error:", error);
    if (error.message.startsWith("Forbidden")) {
      return res.status(403).json({ success: false, error: "Not an admin" });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
}
