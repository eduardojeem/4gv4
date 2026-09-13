import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MODAL = readFileSync(join(process.cwd(), 'src/components/dashboard/customers/CustomerGlobalPaymentModal.tsx'), 'utf8')

describe('el modal de cobro', () => {
  /**
   * «Copiar Cuentas Bancarias» copiaba datos inventados —Mi Empresa S.A., RUC
   * 80012345-6, cuenta 123456789—. Pasados por WhatsApp, el cliente transfería a
   * una cuenta que no era la de la tienda.
   */
  it('no tiene datos bancarios escritos a mano', () => {
    expect(MODAL).not.toContain('80012345-6')
    expect(MODAL).not.toContain('123456789')
    expect(MODAL).not.toContain('Mi Empresa S.A.')
    expect(MODAL).not.toContain('handleCopyBankInfo')
  })

  it('manda la sucursal activa y una clave por intento', () => {
    expect(MODAL).toContain('useOptionalBranch()?.selectedBranchId')
    expect(MODAL).toContain('idempotencyKey,')
    expect(MODAL).toContain('branchId: branchId ?? undefined')
  })

  it('el sobrante necesita confirmación y el comprobante es obligatorio', () => {
    expect(MODAL).toContain('creditExcessToStoreCredit: excessToStoreCredit > 0 && creditExcess')
    expect(MODAL).toContain('Boolean(missingProof)')
  })

  it('no se cierra mientras está cobrando', () => {
    expect(MODAL).toContain('if (!val && !submitting) onClose()')
  })
})
