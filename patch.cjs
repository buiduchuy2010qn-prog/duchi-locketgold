const fs = require('fs');
const path = 'api/src/middlewares/antiBot.js';
let content = fs.readFileSync(path, 'utf8');

const adminCheck = `
function isAdminRequest(req) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return false;
      const payloadString = Buffer.from(payloadBase64, 'base64').toString('utf8');
      const payload = JSON.parse(payloadString);
      if (payload && (payload.role === 'admin' || payload.email === 'buiduchuy2010qn@gmail.com' || payload.email === 'duchuy2010qn@gmail.com' || payload.email === 'nhuyqn2010@gmail.com')) {
        return true;
      }
    }
  } catch (e) {
    return false;
  }
  return false;
}
`;

content = content.replace('function getRequestIp(req) {', adminCheck + '\nfunction getRequestIp(req) {');

// We have two places with `if (req.method === "OPTIONS" || isExemptPath(req.path)) {`
// One in antiBotMiddleware, one in wafSecurityShield.
content = content.replace(
  'if (req.method === "OPTIONS" || isExemptPath(req.path)) {',
  'if (req.method === "OPTIONS" || isExemptPath(req.path) || isAdminRequest(req)) {'
);
content = content.replace(
  'if (req.method === "OPTIONS" || isExemptPath(req.path)) {',
  'if (req.method === "OPTIONS" || isExemptPath(req.path) || isAdminRequest(req)) {'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched');
