import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

// Explicit local-only verification; intentionally not part of hosted Vitest CI.
const sql = readFileSync(new URL('../supabase/tests/marketplace_effective_catalog.sql', import.meta.url), 'utf8')
const result = spawnSync('docker', ['--context', 'desktop-linux', 'exec', '-i',
  'supabase_db_4gv4', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
{ input: sql, encoding: 'utf8', timeout: 60_000 })
if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.error) process.stderr.write(`${result.error.message}\n`)
process.exitCode = result.error ? 1 : result.status ?? 1
