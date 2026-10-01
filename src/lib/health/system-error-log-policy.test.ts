import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20261006140000_secure_system_error_log_ingestion.sql',
)

describe('system error log ingestion policy', () => {
  it('removes direct client inserts and keeps writes server-side', () => {
    expect(existsSync(migrationPath)).toBe(true)
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

    expect(sql).toContain('drop policy if exists "system_error_logs_insert_policy"')
    expect(sql).toContain('revoke insert on public.system_error_logs from anon, authenticated')
    expect(sql).toContain('grant insert on public.system_error_logs to service_role')
    expect(sql).not.toContain('with check (true)')
  })
})
