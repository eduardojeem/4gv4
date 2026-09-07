import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260906201031_marketplace_customer_carts.sql'), 'utf8')

describe('marketplace customer cart migration', () => {
  it('creates the three persistent resources with RLS', () => {
    expect(sql).toContain('create table if not exists public.customer_carts')
    expect(sql).toContain('create table if not exists public.customer_cart_items')
    expect(sql).toContain('create table if not exists public.marketplace_user_preferences')
    expect(sql.match(/enable row level security/g)).toHaveLength(3)
  })

  it('uses ownership predicates and explicit authenticated grants', () => {
    expect(sql).toContain('(select auth.uid()) = user_id')
    expect(sql).toContain('grant select, insert, update, delete on public.customer_carts to authenticated')
    expect(sql).toContain('revoke all on public.customer_carts from anon')
    expect(sql).toContain('exists (select 1 from public.customer_carts')
  })

  it('prevents duplicate carts and duplicate product variants', () => {
    expect(sql).toContain('unique (user_id, organization_id)')
    expect(sql).toContain('customer_cart_items_identity_idx')
    expect(sql).toContain("coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)")
  })

  it('keeps commercial and public-profile consent disabled by default', () => {
    expect(sql).toContain('promotions boolean not null default false')
    expect(sql).toContain('marketing_communications boolean not null default false')
    expect(sql).toContain('public_profile boolean not null default false')
  })
})
