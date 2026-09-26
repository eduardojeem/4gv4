import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { AFTER_SALES_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { SectionGuideModal } from '@/components/dashboard/common/SectionGuideModal'

beforeAll(() => {
  Object.assign(window.HTMLElement.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  })
})

describe('AFTER_SALES_GUIDE — contenido y explicaciones', () => {
  const jsonText = JSON.stringify(AFTER_SALES_GUIDE).toLowerCase()

  it('cuenta con un título descriptivo y badge temático', () => {
    expect(AFTER_SALES_GUIDE.title).toContain('Posventa, Garantías y Devoluciones')
    expect(AFTER_SALES_GUIDE.badgeText).toBe('Posventa & Garantías')
  })

  it('detalla los 6 pasos operativos del ciclo de vida', () => {
    expect(AFTER_SALES_GUIDE.steps.length).toBe(6)
    const titles = AFTER_SALES_GUIDE.steps.map((s) => s.title)
    expect(titles.some((t) => t.includes('comprobante original'))).toBe(true)
    expect(titles.some((t) => t.includes('control de plazos'))).toBe(true)
    expect(titles.some((t) => t.includes('Cambios de producto'))).toBe(true)
    expect(titles.some((t) => t.includes('Retrabajo automático'))).toBe(true)
    expect(titles.some((t) => t.includes('destino físico del stock'))).toBe(true)
    expect(titles.some((t) => t.includes('trazabilidad'))).toBe(true)
  })

  it('incluye consejo clave sobre la caja abierta para reintegros en efectivo', () => {
    expect(AFTER_SALES_GUIDE.tip).toBeDefined()
    expect(jsonText).toContain('sesión de caja abierta')
    expect(jsonText).toContain('saldo a favor')
  })
})

describe('AFTER_SALES_GUIDE — ejemplos prácticos reales', () => {
  it('contiene 5 ejemplos concretos de casos de negocio', () => {
    expect(AFTER_SALES_GUIDE.examples).toBeDefined()
    expect(AFTER_SALES_GUIDE.examples!.length).toBeGreaterThanOrEqual(5)
  })

  it('cubre el caso de devolución en efectivo con reingreso al stock', () => {
    const ex = AFTER_SALES_GUIDE.examples!.find((e) => e.goal.toLowerCase().includes('devolución de producto dentro del plazo'))
    expect(ex).toBeDefined()
    expect(ex!.setup.some((s) => s.includes('7 días'))).toBe(true)
    expect(ex!.result).toContain('reingresa inmediatamente al inventario vendible')
    expect(ex!.result).toContain('caja registradora abierta')
  })

  it('cubre el caso de cambio por modelo superior con cobro de diferencia', () => {
    const ex = AFTER_SALES_GUIDE.examples!.find((e) => e.goal.toLowerCase().includes('modelo superior'))
    expect(ex).toBeDefined()
    expect(ex!.setup.some((s) => s.includes('+₲ 100.000') || s.includes('abona el cliente'))).toBe(true)
    expect(ex!.result).toContain('canje con balance exacto')
  })

  it('cubre el caso de excepción comercial fuera de plazo autorizada', () => {
    const ex = AFTER_SALES_GUIDE.examples!.find((e) => e.goal.toLowerCase().includes('excepción comercial'))
    expect(ex).toBeDefined()
    expect(ex!.setup.some((s) => s.includes('Autorizar excepción comercial fuera de plazo'))).toBe(true)
    expect(ex!.result).toContain('cuarentena aislada')
  })

  it('cubre el caso de garantía de reparación de taller con orden de retrabajo', () => {
    const ex = AFTER_SALES_GUIDE.examples!.find((e) => e.goal.toLowerCase().includes('reparación de taller'))
    expect(ex).toBeDefined()
    expect(ex!.setup.some((s) => s.includes('REP-'))).toBe(true)
    expect(ex!.result).toContain('orden técnica en ₲ 0')
  })

  it('cubre el caso de reintegro como saldo a favor (Store Credit)', () => {
    const ex = AFTER_SALES_GUIDE.examples!.find((e) => e.goal.toLowerCase().includes('saldo a favor'))
    expect(ex).toBeDefined()
    expect(ex!.result).toContain('No sale efectivo físico de la caja')
    expect(ex!.result).toContain('saldo a favor del cliente')
  })
})

describe('AFTER_SALES_GUIDE — renderizado interactivo en modal', () => {
  it('renderiza pestañas de "Paso a paso" y "Ejemplos" cuando se abre el modal', async () => {
    const user = userEvent.setup()
    render(<SectionGuideModal open onOpenChange={() => {}} guide={AFTER_SALES_GUIDE} />)

    expect(screen.getByRole('heading', { name: /Posventa, Garantías y Devoluciones/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /paso a paso/i })).toBeInTheDocument()
    const examplesTab = screen.getByRole('tab', { name: /ejemplos \(5\)/i })
    expect(examplesTab).toBeInTheDocument()

    // Cambiar a la pestaña de Ejemplos
    await user.click(examplesTab)
    expect(screen.getByText(/Devolución de producto dentro del plazo con reintegro en efectivo/i)).toBeInTheDocument()
    expect(screen.getByText(/Cambio de producto por un modelo superior abonando la diferencia/i)).toBeInTheDocument()
  })
})
