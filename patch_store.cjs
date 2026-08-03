const fs = require('fs');
const path = 'api/src/services/userActivityStore.js';
let content = fs.readFileSync(path, 'utf8');

const whitelistTable = `
    await sql\`CREATE TABLE IF NOT EXISTS web_security_whitelist (
      identifier TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      added_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )\`;
`;

content = content.replace(
  'await sql`CREATE TABLE IF NOT EXISTS ip_blacklist (',
  whitelistTable + '\n    await sql`CREATE TABLE IF NOT EXISTS ip_blacklist ('
);

content = content.replace(
  'await loadBlacklistedIps().catch(() => {});',
  'await loadBlacklistedIps().catch(() => {});\n    await loadWhitelistedIdentifiers().catch(() => {});'
);

const whitelistMethods = `
// 2.1. Quản lý Whitelist (Danh sách miễn trừ)
const whitelistedIdentifiersMemory = new Set();
async function loadWhitelistedIdentifiers() {
  const sql = getSql();
  if (!sql) return;
  try {
    const res = await sql\`SELECT identifier FROM web_security_whitelist\`;
    whitelistedIdentifiersMemory.clear();
    for (const row of res) {
      whitelistedIdentifiersMemory.add(row.identifier);
    }
  } catch {}
}

async function addWhitelist(identifier, type = "ip", added_by = "SUPER_ADMIN") {
  const sql = getSql();
  if (!sql || !identifier) return { success: false };
  await sql\`
    INSERT INTO web_security_whitelist (identifier, type, added_by, created_at)
    VALUES (\${identifier}, \${type}, \${added_by}, NOW())
    ON CONFLICT (identifier) DO NOTHING
  \`;
  whitelistedIdentifiersMemory.add(identifier);
  return { success: true, identifier };
}

async function removeWhitelist(identifier) {
  const sql = getSql();
  if (!sql || !identifier) return { success: false };
  await sql\`DELETE FROM web_security_whitelist WHERE identifier = \${identifier}\`;
  whitelistedIdentifiersMemory.delete(identifier);
  return { success: true, identifier };
}

async function listWhitelist() {
  const sql = getSql();
  if (!sql) return [];
  return await sql\`SELECT identifier, type, added_by, created_at FROM web_security_whitelist ORDER BY created_at DESC LIMIT 1000\`;
}

function isWhitelisted(identifier) {
  if (!identifier) return false;
  return whitelistedIdentifiersMemory.has(identifier);
}
`;

content = content.replace(
  '// 2. Quyền Cấm Cửa Địa Chỉ IP Vĩnh Viễn',
  whitelistMethods + '\n\n  // 2. Quyền Cấm Cửa Địa Chỉ IP Vĩnh Viễn'
);

content = content.replace(
  'addIpBlacklist,',
  'addIpBlacklist,\n    addWhitelist,\n    listWhitelist,\n    removeWhitelist,\n    isWhitelisted,\n    loadWhitelistedIdentifiers,'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched userActivityStore.js');
