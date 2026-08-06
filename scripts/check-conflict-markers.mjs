import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const ROOTS = ["src", "api/src"];
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const MARKER_RE = /^(<<<<<<<|=======|>>>>>>>)(?:\s|$)/m;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

const badFiles = [];
for (const root of ROOTS) {
  for (const file of await collectFiles(root)) {
    const source = await readFile(file, "utf8");
    if (MARKER_RE.test(source)) badFiles.push(file);
  }
}

if (badFiles.length) {
  console.error("Unresolved merge conflict markers found:");
  for (const file of badFiles) console.error(`- ${file}`);
  process.exit(1);
}

console.log("No unresolved merge conflict markers found in source.");
