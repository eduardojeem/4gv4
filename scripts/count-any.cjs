const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== ".git") {
        results = results.concat(walk(fullPath));
      }
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk("src");
const stats = [];
let totalAny = 0;

for (const f of files) {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  let fileAny = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    const matches = line.match(/\bany\b/g);
    if (matches) {
      fileAny += matches.length;
    }
  }
  if (fileAny > 0) {
    stats.push({ file: f, count: fileAny });
    totalAny += fileAny;
  }
}

stats.sort((a, b) => b.count - a.count);
console.log("TOTAL any instances in src/:", totalAny);
console.log("Top 25 files:");
stats
  .slice(0, 25)
  .forEach((s, i) => console.log(`${i + 1}. [${s.count}] ${s.file}`));
