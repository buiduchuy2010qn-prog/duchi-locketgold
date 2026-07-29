import fs from "fs";
import path from "path";

function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) rimraf(p);
    else fs.unlinkSync(p);
  }
  try { fs.rmdirSync(dir); } catch {}
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync("dist/index.html")) {
  console.error("[prepare-static] dist/ missing - run vite build first");
  process.exit(1);
}

// Preserve original static resources (icons/images/...)
const STATIC_KEEP = ["fonts", "icons", "images", "pwa-icons", "svg"];
const backup = path.join(".tmp-static-keep");
rimraf(backup);
fs.mkdirSync(backup, { recursive: true });

for (const d of STATIC_KEEP) {
  const src = path.join("public", d);
  if (fs.existsSync(src)) copyDir(src, path.join(backup, d));
}

// Prepare 'public' for Railway
rimraf("public");
copyDir("dist", "public");

// Prepare 'vercel-static' for Vercel
rimraf("vercel-static");
copyDir("dist", "vercel-static");

// Restore preserved static assets to both destinations if they were missing from dist
for (const d of STATIC_KEEP) {
  const fromBackup = path.join(backup, d);
  const destPublic = path.join("public", d);
  const destVercel = path.join("vercel-static", d);
  if (fs.existsSync(fromBackup)) {
    if (!fs.existsSync(destPublic)) copyDir(fromBackup, destPublic);
    if (!fs.existsSync(destVercel)) copyDir(fromBackup, destVercel);
  }
}
rimraf(backup);

// Add _redirects to both
fs.writeFileSync("public/_redirects", "/*    /index.html   200\n");
fs.writeFileSync("vercel-static/_redirects", "/*    /index.html   200\n");

// Ensure version.json is copied correctly if SPA rewrite swallowed it previously
if (fs.existsSync("dist/version.json")) {
  if (!fs.existsSync("public/version.json")) fs.copyFileSync("dist/version.json", "public/version.json");
  if (!fs.existsSync("vercel-static/version.json")) fs.copyFileSync("dist/version.json", "vercel-static/version.json");
}

const assetCountPublic = fs.existsSync("public/assets") ? fs.readdirSync("public/assets").length : 0;
const assetCountVercel = fs.existsSync("vercel-static/assets") ? fs.readdirSync("vercel-static/assets").length : 0;
console.log(`[prepare-static] OK: dist -> public (${assetCountPublic} assets)`);
console.log(`[prepare-static] OK: dist -> vercel-static (${assetCountVercel} assets)`);
