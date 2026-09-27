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

  it('presenta un flujo compacto sin simular un asistente de pasos', () => {
    const modal = readFileSync(
      resolve(process.cwd(), 'src/app/dashboard/pos/components/CheckoutModal.tsx'),
      'utf8',
    )
    const methods = readFileSync(
      resolve(process.cwd(), 'src/app/dashboard/pos/components/checkout/PaymentMethods.tsx'),
      'utf8',
    )

    expect(modal).not.toContain('aria-label="Pasos para cobrar la venta"')
    expect(modal).not.toContain('1. Cliente')
    expect(modal).not.toContain('2. Forma de cobro')
    expect(modal).not.toContain('3. Revisar y confirmar')
    expect(modal).toContain("'Cobrar y entregar'")
    expect(modal).toContain("'Cobrar sin entregar'")
    expect(modal).toContain('deliveryEligibility.blockingTickets.join')
    expect(methods).toContain("{isMixedPayment ? 'Usar un solo medio' : 'Combinar medios'}")
    expect(methods).toContain("cash: 'Efectivo'")
    expect(methods).toContain("card: 'Tarjeta'")
    expect(methods).toContain("transfer: 'Transferencia'")
    expect(methods).toContain("credit: 'Crédito'")
  })
})
