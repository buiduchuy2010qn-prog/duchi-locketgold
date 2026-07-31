import { verifyAdmin } from "../_utils/auth.js";
import { initDb } from "../_utils/db.js";

export default async function handler(req, res) {
  // Add Cache-Control no-store
  res.setHeader("Cache-Control", "no-store, max-age=0");
  
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await initDb(); // Init tables if not exist
    const { uid, email } = await verifyAdmin(req);
    
    return res.status(200).json({ 
      success: true, 
      uid, 
      email,
      isAdmin: true 
    });
  } catch (error) {
    if (error.message.startsWith("Forbidden")) {
      return res.status(403).json({ success: false, error: "Not an admin" });
    }
    return res.status(401).json({ success: false, error: error.message });
  }
}
