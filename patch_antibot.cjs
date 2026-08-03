const fs = require('fs');
const path = 'api/src/middlewares/antiBot.js';
let content = fs.readFileSync(path, 'utf8');

const updatedAdminCheck = `
function isAdminRequest(req) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return false;
      const payloadString = Buffer.from(payloadBase64, 'base64').toString('utf8');
      const payload = JSON.parse(payloadString);

      // Check against in-memory whitelist (if available)
      const userActivityStore = require('../services/userActivityStore');
      if (userActivityStore.isWhitelisted && payload.email && userActivityStore.isWhitelisted(payload.email)) {
        return true;
      }
      if (userActivityStore.isWhitelisted && payload.uid && userActivityStore.isWhitelisted(payload.uid)) {
        return true;
      }

      if (payload && (payload.role === 'admin' || payload.email === 'buiduchuy2010qn@gmail.com' || payload.email === 'duchuy2010qn@gmail.com' || payload.email === 'nhuyqn2010@gmail.com')) {
        return true;
      }
    }
  } catch (e) {
    return false;
  }
  
  // IP Whitelist Check
  try {
    const ip = getRequestIp(req);
    const userActivityStore = require('../services/userActivityStore');
    if (userActivityStore.isWhitelisted && userActivityStore.isWhitelisted(ip)) {
      return true;
    }
  } catch (e) {}

  return false;
}
`;

// Replace the old isAdminRequest with the new one
content = content.replace(/function isAdminRequest\(req\) {[\s\S]*?}\n\n/m, updatedAdminCheck + '\n');
// Wait, my regex might not perfectly match if it was injected with patch.cjs before.
// I'll just use a more robust replacement strategy.
