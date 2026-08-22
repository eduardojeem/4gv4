import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('CheckoutModal sale confirmation contract', () => {
  it('routes every checkout action through the confirmation instead of processing directly', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/dashboard/pos/components/CheckoutModal.tsx'),
      'utf8',
    )

    expect(source).not.toContain('onClick={processSale}')
    expect(source).not.toContain('onClick={processMixedPayment}')
    expect(source.match(/openSaleConfirmation\('sale'\)/g)).toHaveLength(2)
    expect(source.match(/openSaleConfirmation\('mixed'\)/g)).toHaveLength(1)
    expect(source).toContain('confirmationSubmittedRef.current')
  })
})
