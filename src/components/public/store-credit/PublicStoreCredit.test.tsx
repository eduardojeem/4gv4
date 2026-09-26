import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('public store-credit UI contract', () => {
  it('loads tenant-scoped credit and explains available, reserved and applied amounts', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/components/public/store-credit/PublicStoreCredit.tsx'), 'utf8')

    expect(component).toContain('/api/public/store-credit')
    expect(component).toContain('Saldo disponible')
    expect(component).toContain('Saldo reservado')
    expect(component).toContain('Usar saldo a favor')
    expect(component).toContain('Se reservará al enviar el pedido')
  })

  it('sends the selected amount with the public order', () => {
    const cart = readFileSync(resolve(process.cwd(), 'src/components/public/cart/CartPageClient.tsx'), 'utf8')

    expect(cart).toContain('storeCreditAmount')
    expect(cart).toContain('<PublicStoreCredit')
    expect(cart).toContain('totalAfterStoreCredit')
  })
})
