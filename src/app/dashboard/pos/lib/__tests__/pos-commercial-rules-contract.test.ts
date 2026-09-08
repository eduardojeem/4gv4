import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('reglas comerciales del POS', () => {
  it('no inventa descuentos por cantidad fuera del catálogo de promociones', () => {
    const cart = readFileSync(resolve(process.cwd(), 'src/app/dashboard/pos/hooks/useOptimizedCart.ts'), 'utf8')
    expect(cart).not.toContain('if (quantity >= 50) autoDiscount = 15')
    expect(cart).not.toContain('if (quantity >= 20) autoDiscount = 10')
  })

  it('usa descuento configurado del cliente y conserva sus puntos canónicos', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/dashboard/pos/page.tsx'), 'utf8')
    const customers = readFileSync(resolve(process.cwd(), 'src/app/dashboard/pos/contexts/POSCustomerContext.tsx'), 'utf8')
    expect(page).toContain('activeCustomer as any)?.discount_percentage')
    expect(page).not.toContain('const VIP_DISCOUNT_RATE = 10')
    expect(customers).not.toContain('const loyaltyPoints = Math.floor')
  })
})
