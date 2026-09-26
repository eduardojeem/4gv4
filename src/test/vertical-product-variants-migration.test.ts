import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const migrationName = readdirSync(migrationsDirectory).find((name) =>
  name.endsWith('_vertical_product_variants.sql'),
)

describe('vertical product variants migration', () => {
  it('adds tenant, branch stock, RLS and atomic variant operations', () => {
    expect(migrationName).toBeDefined()

    const migrationPath = resolve(migrationsDirectory, migrationName ?? 'missing.sql')
    expect(existsSync(migrationPath)).toBe(true)

    const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

    expect(sql).toContain('add column if not exists organization_id')
    expect(sql).toContain('create table if not exists public.product_variant_attributes')
    expect(sql).toContain('create table if not exists public.branch_variant_inventory')
    expect(sql).toContain('create table if not exists public.variant_inventory_movements')
    expect(sql).toContain('create or replace function public.save_product_with_variants')
    expect(sql).toContain('create or replace function public.adjust_variant_stock_atomic')
    expect(sql).toContain('create or replace function public.restore_variant_stock_atomic')
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('variant_stock_insufficient')
    expect(sql).toContain('to service_role')
  })
})
