const fs = require('fs');
let content = fs.readFileSync('src/pages/Public/AdminUsers/index.jsx', 'utf8');

const search = `      if (p?.list) setBlacklistedIps(p.list || []);\r\n      if (typeof isUserAction === "boolean" && isUserAction) {`;
const replace = `      if (p?.list) setBlacklistedIps(p.list || []);\r\n      const w = await adminRequest(\`/whitelist?_=\${Date.now()}\`);\r\n      if (w?.list) setWhitelistItems(w.list || []);\r\n      if (typeof isUserAction === "boolean" && isUserAction) {`;

if (content.includes(search)) {
  fs.writeFileSync('src/pages/Public/AdminUsers/index.jsx', content.replace(search, replace));
  console.log("OK: whitelist fetch added");
} else {
  console.log("FAIL: search string not found");
}
