import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260928003500_create_legal_documents.sql',
)

describe('legal documents migration', () => {
  it('creates the versioned document store with one draft and one published version per type', () => {
    expect(existsSync(migrationPath)).toBe(true)
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

    expect(sql).toContain('create table if not exists public.legal_documents')
    expect(sql).toContain("where status = 'draft'")
    expect(sql).toContain("where status = 'published'")
    expect(sql).toContain('create or replace function public.publish_legal_document')
  })

  it('keeps drafts server-only and does not expose the publishing RPC to clients', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

    expect(sql).toContain('enable row level security')
    expect(sql).toContain('revoke all on table public.legal_documents from public, anon, authenticated')
    expect(sql).toContain('revoke all on function public.publish_legal_document(uuid, uuid) from public, anon, authenticated')
    expect(sql).toContain('grant execute on function public.publish_legal_document(uuid, uuid) to service_role')
  })
})
