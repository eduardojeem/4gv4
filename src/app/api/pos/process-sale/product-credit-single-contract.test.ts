import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()

describe('POS product financing keeps one ticket credit', () => {
  it('normalizes one credit object and sends it through both atomic RPC versions', () => {
    const route = readFileSync(resolve(workspace, 'src/app/api/pos/process-sale/route.ts'), 'utf8')

    expect(route).toContain('const credit = normalizeCredit(body.p_credit)')
    expect(route.match(/p_credit: credit,/g)).toHaveLength(2)
    expect(route).not.toContain('p_product_credits')
  })

  it('uses a product plan only to prefill the ticket-level checkout terms', () => {
    const page = readFileSync(resolve(workspace, 'src/app/dashboard/pos/page.tsx'), 'utf8')

    expect(page).toContain('applyProductCreditSuggestion({')
    expect(page).toContain("setPaymentMethod('credit')")
    expect(page).not.toContain('productCredits:')
  })
})
