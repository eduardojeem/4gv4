import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'repairs', 'customers', 'route.ts'), 'utf8')

describe('repair customer person and company contract', () => {
  it('accepts and persists separated personal names and the wholesale company', () => {
    expect(route).toContain('first_name:')
    expect(route).toContain('last_name:')
    expect(route).toContain('company_name:')
    expect(route).toContain('first_name, last_name, company_name')
  })

  it('adds the optional company column without replacing existing customer data', () => {
    const migrationsDirectory = join(process.cwd(), 'supabase', 'migrations')
    const migrationName = readdirSync(migrationsDirectory)
      .find((name) => name.endsWith('_add_customer_company_name.sql'))

    expect(migrationName).toBeDefined()
    const migration = readFileSync(join(migrationsDirectory, migrationName!), 'utf8').toLowerCase()
    expect(migration).toContain('alter table public.customers')
    expect(migration).toContain('add column if not exists company_name text')
  })
})
