import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('aislamiento local del POS', () => {
  it('separa carrito y ventas en espera por usuario y sucursal', () => {
    const root = process.cwd()
    const page = readFileSync(resolve(root, 'src/app/dashboard/pos/page.tsx'), 'utf8')
    const cart = readFileSync(resolve(root, 'src/app/dashboard/pos/hooks/useOptimizedCart.ts'), 'utf8')
    const held = readFileSync(resolve(root, 'src/app/dashboard/pos/hooks/useHeldSales.ts'), 'utf8')

    expect(page).toContain("`${user?.id || 'anonymous'}:${selectedBranchId || 'unselected'}`")
    expect(cart).toContain('`pos.cart:${storageScope}`')
    expect(held).toContain('`pos.heldSales:${storageScope}`')
    expect(cart).not.toContain("localStorage.getItem('pos.cart')")
    expect(held).not.toContain("const STORAGE_KEY = 'pos.heldSales'")
  })
})
