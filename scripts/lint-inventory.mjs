import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ESLint } from 'eslint'

// Las rutas de Windows se resuelven con path.win32 aunque el script corra en Linux (CI).
const pathFlavor = (rootDirectory) =>
  /^[A-Za-z]:[\\/]/.test(rootDirectory) || rootDirectory.startsWith('\\\\') ? path.win32 : path.posix

const normalizePath = (filePath, rootDirectory) => {
  const flavor = pathFlavor(rootDirectory)
  return flavor.relative(rootDirectory, filePath).split(flavor.sep).join('/')
}

export function summarizeLintResults(results, rootDirectory = process.cwd()) {
  const byRuleCounts = new Map()

  for (const result of results) {
    for (const message of result.messages) {
      const rule = message.ruleId ?? 'unclassified'
      byRuleCounts.set(rule, (byRuleCounts.get(rule) ?? 0) + 1)
    }
  }

  return {
    errors: results.reduce((total, result) => total + result.errorCount, 0),
    warnings: results.reduce((total, result) => total + result.warningCount, 0),
    byRule: Object.fromEntries(
      [...byRuleCounts.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
    byFile: results
      .map((result) => ({
        file: normalizePath(result.filePath, rootDirectory),
        errors: result.errorCount,
        warnings: result.warningCount,
      }))
      .filter(({ errors, warnings }) => errors > 0 || warnings > 0)
      .sort((left, right) => left.file.localeCompare(right.file)),
  }
}

async function run() {
  const eslint = new ESLint()
  const results = await eslint.lintFiles(['src'])
  const summary = summarizeLintResults(results)

  console.log(JSON.stringify(summary, null, 2))
  if (summary.errors > 0) process.exitCode = 1
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  run().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
