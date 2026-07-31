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
      return res.status(400).json({ success: false, error: "Bad Request" });
    }

    if (adminUid === targetUid) {
      return res.status(403).json({ success: false, error: "Cannot delete yourself" });
    }

    await admin.auth().deleteUser(targetUid);
    await auditLog(adminUid, "DELETE_AUTH", targetUid, "User Auth deleted");

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error.message === "Forbidden") {
      return res.status(403).json({ success: false, error: "Not an admin" });
    }
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
}
