import admin from "../../_utils/firebaseAdmin.js";
import { sql } from "../../_utils/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      return res.status(401).json({ error: "Unauthorized: " + error.message });
    }

    const uid = decodedToken.uid;
    const { browser, os, device, loginMethod, buildVersion } = req.body;
    
    // Lấy thông tin IP và vị trí từ header của Vercel (khi deploy)
    let ipAddress = req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "Unknown";
    if (ipAddress && ipAddress.includes(",")) {
      ipAddress = ipAddress.split(",")[0].trim(); // Proxy Cloudflare/Vercel
    }
    const country = req.headers["x-vercel-ip-country"] || "Unknown";
    const city = req.headers["x-vercel-ip-city"] || "Unknown";

    if (sql) {
      await sql`
        INSERT INTO login_history (uid, ip_address, country, city, browser, os, device, login_method, build_version)
        VALUES (${uid}, ${ipAddress}, ${country}, ${city}, ${browser}, ${os}, ${device}, ${loginMethod}, ${buildVersion});
      `;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Login history error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
