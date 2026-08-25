import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('product credit defaults consolidation', () => {
  it('removes the duplicate financing editor from organization settings', () => {
    const settingsPage = read('src/app/admin/settings/page.tsx')

    expect(settingsPage).not.toContain('value="financing"')
    expect(settingsPage).not.toContain('defaultInstallmentRates')
    expect(settingsPage).toContain('sm:grid-cols-3')
  })

  it('uses product_credit_defaults for quick and bulk installment plans', () => {
    const productModal = read('src/components/dashboard/product-modal.tsx')

    expect(productModal).not.toContain("import { useSharedSettings }")
    expect(productModal).not.toContain('settings.defaultInstallmentRates')
    expect(productModal).toContain('defaultRateForInstallmentCount')
    expect(productModal).toContain('useState<Record<number, { checked: boolean; rate: string }>>({})')
  })

  it('keeps existing new plans and migrates only missing legacy installment counts', () => {
    const migration = read('supabase/migrations/20260825222525_consolidate_product_credit_defaults.sql')

    expect(migration).toContain("modules #> '{admin_settings,defaultInstallmentRates}'")
    expect(migration).toContain("ws.key = 'product_credit_defaults'")
    expect(migration).toContain("existing_plan->>'count'")
    expect(migration).toContain('ON CONFLICT (organization_id, key) DO NOTHING')
  })
})
