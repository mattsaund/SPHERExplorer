// Runs after the build. Leaves a .br and a .gz twin beside every text file of the built site,
// so the server can send them as they are instead of compressing on every request.
// Written with Claude Code (Anthropic) assistance.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = new URL("../dist/", import.meta.url).pathname;
// Source maps are left alone: only developers fetch them.
const TEXT = new Set([".js", ".css", ".html", ".svg", ".json", ".wasm", ".txt"]);

function walk(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

let before = 0;
let after = 0;
for (const file of walk(root)) {
  if (!TEXT.has(path.extname(file))) continue;
  const data = fs.readFileSync(file);
  if (data.length < 1024) continue; // too small to gain anything
  const br = zlib.brotliCompressSync(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length } });
  const gz = zlib.gzipSync(data, { level: 9 });
  fs.writeFileSync(file + ".br", br);
  fs.writeFileSync(file + ".gz", gz);
  before += data.length;
  after += br.length;
}
console.log(`Compressed the site's text files: ${(before / 1e6).toFixed(2)} MB down to ${(after / 1e6).toFixed(2)} MB with Brotli.`);
