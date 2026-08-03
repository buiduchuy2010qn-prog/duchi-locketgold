const fs = require('fs');
const path = 'api/src/routes/adminRoutes.js';
let content = fs.readFileSync(path, 'utf8');

const whitelistApis = `
  // 2.2. Quản lý Whitelist (Kim bài miễn tử)
  router.get("/whitelist", requireActiveAdminSession, async (req, res) => {
    const list = await userActivityStore.listWhitelist();
    res.json({ success: true, count: list.length, list });
  });

  router.post("/whitelist", requireActiveAdminSession, async (req, res) => {
    const { identifier, type } = req.body;
    if (!identifier || !type) return res.status(400).json({ success: false, error: "Thiếu thông tin" });
    await userActivityStore.addWhitelist(identifier, type, req.adminRole || "SUPER_ADMIN");
    await audit(req, "ADD_WHITELIST", null, \`Added \${type} to whitelist: \${identifier}\`);
    res.json({ success: true, message: \`Đã thêm \${identifier} vào danh sách miễn trừ\` });
  });

  router.delete("/whitelist/:identifier", requireActiveAdminSession, async (req, res) => {
    const identifier = decodeURIComponent(req.params.identifier);
    await userActivityStore.removeWhitelist(identifier);
    await audit(req, "REMOVE_WHITELIST", null, \`Removed from whitelist: \${identifier}\`);
    res.json({ success: true, message: \`Đã xóa \${identifier} khỏi danh sách miễn trừ\` });
  });
`;

// Inject into adminRoutes
// Wait, `addIpBlacklist` is extracted from `userActivityStore`. Since `adminRoutes.js` already imports things from userActivityStore, I should make sure it imports the whole store or the specific functions.
// Let's just `const userActivityStore = require('../services/userActivityStore');` at the top.
const importStore = `const userActivityStore = require("../services/userActivityStore");`;
if (!content.includes(importStore)) {
  content = content.replace(
    'const {',
    importStore + '\nconst {'
  );
}

content = content.replace(
  '// 3. Quản Lý Phiên Quản Trị & Mã PIN',
  whitelistApis + '\n  // 3. Quản Lý Phiên Quản Trị & Mã PIN'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched adminRoutes.js');
