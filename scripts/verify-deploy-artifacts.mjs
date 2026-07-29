import fs from "fs";
import path from "path";

const dirs = ["dist", "public", "vercel-static"];

function readVersion(dir) {
  const p = path.join(dir, "version.json");
  if (!fs.existsSync(p)) {
    console.error(`[verify] ERROR: ${p} does not exist`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    console.error(`[verify] ERROR: Failed to parse ${p}`);
    return null;
  }
}

console.log("[verify] Checking version.json consistency...");
const versions = dirs.map(d => ({ dir: d, data: readVersion(d) }));

const hasErrors = versions.some(v => !v.data);
if (hasErrors) process.exit(1);

const ref = versions[0].data;
for (let i = 1; i < versions.length; i++) {
  const cur = versions[i].data;
  if (cur.buildId !== ref.buildId || cur.commitHash !== ref.commitHash || cur.deployedAt !== ref.deployedAt) {
    console.error(`[verify] ERROR: version.json mismatch between dist and ${versions[i].dir}`);
    console.error(`dist:`, ref);
    console.error(`${versions[i].dir}:`, cur);
    process.exit(1);
  }
}

console.log("[verify] Checking required files existence...");
const requiredFiles = ["index.html", "sw.js", "version.json"];
for (const dir of dirs) {
  for (const f of requiredFiles) {
    if (!fs.existsSync(path.join(dir, f))) {
      console.error(`[verify] ERROR: Missing required file ${f} in ${dir}`);
      process.exit(1);
    }
  }
}

console.log("[verify] Checking assets referenced in index.html...");
const htmlPath = path.join("dist", "index.html");
const html = fs.readFileSync(htmlPath, "utf-8");

// match src="/assets/..." or href="/assets/..."
const assetRegex = /(?:src|href)="(\/assets\/[^"]+)"/g;
let match;
const expectedAssets = [];
while ((match = assetRegex.exec(html)) !== null) {
  expectedAssets.push(match[1].substring(1)); // remove leading slash
}

for (const dir of dirs) {
  for (const asset of expectedAssets) {
    const assetPath = path.join(dir, asset);
    if (!fs.existsSync(assetPath)) {
      console.error(`[verify] ERROR: Referenced asset ${asset} missing in ${dir}`);
      process.exit(1);
    }
  }
}

// Optionally verify there are no accumulated old hashes in vercel-static/public.
// We cleared them during prepare-static via rimraf, so this should be fine.

console.log(`[verify] SUCCESS! Deploy artifacts are consistent across ${dirs.join(", ")}`);
