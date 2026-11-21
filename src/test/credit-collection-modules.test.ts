// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('credit collection module gates', () => {
  it('collects from Customers or Credits, and installments need the Credits module', () => {
    const route = read('src/app/api/customers/[id]/collect-payment/route.ts')
    expect(route).toContain("const COLLECTION_MODULES = ['crm', 'credits'] as const")
    expect(route).toContain("module: COLLECTION_MODULES },")
    expect(route).toContain("allDebts.filter((debt) => debt.type !== 'installment')")
    expect(route).toContain("row.type === 'installment' && row.amount > 0) && !(await creditsModuleEnabled(organization.id))")
  })

  it('opens the cash check and the credit file of the app from either module', () => {
    expect(read('src/app/api/customers/[id]/collection-context/route.ts')).toContain("module:['crm','credits']")
    expect(read('src/app/api/credits/batch/route.ts')).toContain("module:['crm','credits']")
  })

  it('validates both collection routes against the organization currency', () => {
    for (const path of ['src/app/api/credits/route.ts', 'src/app/api/customers/[id]/collect-payment/route.ts']) {
      expect(read(path), path).toContain('currency: await readCollectionCurrency(')
    }
  })
})
