const fs = require('fs');
const path = 'src/pages/Public/AdminUsers/index.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'const p = await adminRequest(`/ip-blacklist?_=${Date.now()}`);\n        if (p?.list) setBlacklistedIps(p.list || []);',
  'const p = await adminRequest(`/ip-blacklist?_=${Date.now()}`);\n        if (p?.list) setBlacklistedIps(p.list || []);\n        const w = await adminRequest(`/whitelist?_=${Date.now()}`);\n        if (w?.list) setWhitelistItems(w.list || []);'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched fetchAdvancedData');
