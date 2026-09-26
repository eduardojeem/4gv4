import { ESLint } from "eslint";

async function run() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(["src"]);

  const anyFiles = [];
  let total = 0;

  for (const result of results) {
    const relativePath = result.filePath.split(/[/\\]src[/\\]/)[1]
      ? "src/" + result.filePath.split(/[/\\]src[/\\]/)[1].replace(/\\/g, "/")
      : result.filePath.replace(/\\/g, "/");
    const anyMessages = result.messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-explicit-any",
    );
    if (anyMessages.length > 0) {
      anyFiles.push({ file: relativePath, count: anyMessages.length });
      total += anyMessages.length;
    }
  }

  console.log(`TOTAL REMAINING ANY: ${total}`);

  const groups = {};
  for (const f of anyFiles) {
    const parts = f.file.split("/");
    const folder = parts.slice(0, 2).join("/");
    groups[folder] = (groups[folder] || 0) + f.count;
  }

  console.log("\n--- BY DIRECTORY ---");
  for (const [dir, count] of Object.entries(groups).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`${dir}: ${count}`);
  }

  console.log("\n--- TOP 30 FILES WITH ANY ---");
  for (const f of anyFiles.sort((a, b) => b.count - a.count).slice(0, 30)) {
    console.log(`${f.file}: ${f.count}`);
  }
}

run().catch(console.error);
