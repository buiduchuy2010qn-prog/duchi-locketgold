import { verifyAdmin } from "../_utils/auth.js";
import { initDb } from "../_utils/db.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await initDb();
    const { uid, email } = await verifyAdmin(req);
    
    return res.status(200).json({ 
      success: true, 
      uid, 
      email,
      isAdmin: true 
    });
  } catch (error) {
    if (error.message === "Forbidden") {
      return res.status(403).json({ success: false, error: "Not an admin" });
    }
    // Redact internal error trace
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
}
