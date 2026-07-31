import admin from "../../_utils/firebaseAdmin.js";
import { verifyAdmin, auditLog } from "../../_utils/auth.js";
import { sql } from "../../_utils/db.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { uid } = await verifyAdmin(req);
    
    // Pagination params
    const maxResults = parseInt(req.query.limit) || 50;
    const pageToken = req.query.pageToken || undefined;
    const search = req.query.search || ""; // Not fully supported by listUsers efficiently, but we can do basic filtering

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

    // Local search filter if search is provided
    if (search) {
      const lowerSearch = search.toLowerCase();
      users = users.filter(u => 
        (u.email && u.email.toLowerCase().includes(lowerSearch)) || 
        (u.displayName && u.displayName.toLowerCase().includes(lowerSearch)) ||
        u.uid.toLowerCase().includes(lowerSearch)
      );
    }

    // Lấy login history count cho từng user (nếu cần thiết) hoặc chỉ lịch sử đăng nhập cuối cùng
    // Ở đây tối ưu hóa: lấy tất cả login history của list user
    const uids = users.map(u => u.uid);
    let loginData = [];
    if (sql && uids.length > 0) {
      // Get the latest login info
      loginData = await sql`
        SELECT DISTINCT ON (uid) uid, ip_address, country, city, browser, os, device, created_at
        FROM login_history
        WHERE uid = ANY(${uids})
        ORDER BY uid, created_at DESC
      `;
    }

    const historyMap = {};
    loginData.forEach(l => {
      historyMap[l.uid] = l;
    });

    users = users.map(u => ({
      ...u,
      latestLoginData: historyMap[u.uid] || null
    }));

    await auditLog(uid, "LIST_USERS", null, `Listed users, limit: ${maxResults}`);

    return res.status(200).json({ 
      success: true, 
      users,
      pageToken: listUsersResult.pageToken
    });
  } catch (error) {
    console.error("List users error:", error);
    if (error.message.startsWith("Forbidden")) {
      return res.status(403).json({ success: false, error: "Not an admin" });
    }
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
}
