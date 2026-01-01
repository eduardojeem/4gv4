const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'package.json',
  'components.json',
  'tsconfig.json',
  'package-lock.json',
  '.eslintrc.json',
  '.swcrc',
  '.babelrc',
  'next.config.js', // checks if it's json by mistake
];

function checkFile(file) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    return;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // For tsconfig, we need to strip comments if any, but standard JSON.parse fails on comments
    // If the build fails with JSON.parse, it implies strict JSON is expected.
    JSON.parse(content);
    console.log(`✅ ${file} is valid JSON`);
  } catch (e) {
    console.error(`❌ ${file} is INVALID JSON: ${e.message}`);
    // Show context around the error
    const content = fs.readFileSync(filePath, 'utf8');
    // Attempt to extract position
    const match = e.message.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1]);
      console.log(`Context at position ${pos}:`);
      const start = Math.max(0, pos - 50);
      const end = Math.min(content.length, pos + 50);
      console.log(content.substring(start, end));
      console.log('^'.padStart(pos - start + 1));
    }
  }
}

// Also scan src for json files
function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
                scanDir(fullPath);
            }
        } else if (file.endsWith('.json')) {
             checkFile(path.relative(process.cwd(), fullPath));
        }
    }
}

console.log('Checking root JSON files...');
filesToCheck.forEach(checkFile);

console.log('Scanning src for JSON files...');
scanDir(path.join(process.cwd(), 'src'));
