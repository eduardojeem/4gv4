import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260903033245_storefront_publication_opt_in.sql'), 'utf8')
const onboarding = readFileSync(resolve(process.cwd(), 'src/app/api/onboarding/complete/route.ts'), 'utf8')

describe('storefront publication migration', () => {
  it('preserves existing access while making new organizations private', () => {
    expect(sql).toContain('set storefront_public = coalesce(marketplace_public, true)')
    expect(sql).toContain('alter column storefront_public set default false')
    expect(sql).toContain('alter column marketplace_public set default false')
  })
  it('initializes new organizations in WhatsApp mode without replacing saved choices', () => {
    expect(sql).toContain("values (new.id, 'checkout', '{\"commerceMode\":\"whatsapp\"}'::jsonb)")
    expect(sql).toContain('on conflict (organization_id, key) do nothing')
  })
  it('prevents onboarding from publishing and restricts raw website settings', () => {
    expect(onboarding).not.toContain('marketplacePublic: true')
    expect(sql).not.toContain('marketplace_public = true')
    expect(sql).toContain('create policy website_settings_publication_gate')
    expect(sql).toContain('org.storefront_public = true')
  })
})
