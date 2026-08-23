/**
 * Editor de datos predeterminados de productos a crédito.
 *
 * Cubre lo que pidió el pedido: que los datos existentes se vean y se puedan
 * editar, que se guarden con la forma correcta, y que cambiar la base de
 * cálculo (costo vs venta) mueva realmente los importes de la vista previa.
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { ProductCreditDefaultsSchema, SETTING_SCHEMAS, isWebsiteSettingKey } from '@/lib/validation/website-settings'
import type { WebsiteSettings } from '@/types/website-settings'

const updateSetting = vi.fn()

let hookState: {
  settings: WebsiteSettings | null
  isLoading: boolean
  error: string | null
  isSaving: boolean
}

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({ ...hookState, updateSetting, refetch: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { ProductCreditDefaultsEditor } from '@/components/dashboard/products/ProductCreditDefaultsEditor'

function baseSettings(): WebsiteSettings {
  return getWebsiteSettingsDefaults()
}

describe('product_credit_defaults como clave de settings', () => {
  it('la API la acepta como clave editable', () => {
    // Sin esto el PUT responde "Invalid setting key" y no se guarda nada,
    // aunque la UI funcione perfecto.
    expect(isWebsiteSettingKey('product_credit_defaults')).toBe(true)
    expect(SETTING_SCHEMAS.product_credit_defaults).toBeDefined()
  })

  it('los defaults del sistema pasan su propio esquema', () => {
    const parsed = ProductCreditDefaultsSchema.safeParse(
      getWebsiteSettingsDefaults().product_credit_defaults,
    )
    expect(parsed.success).toBe(true)
  })

  it('rechaza planes con la misma cantidad de cuotas repetida', () => {
    const invalid = {
      ...getWebsiteSettingsDefaults().product_credit_defaults!,
      plans: [{ count: 6, rate: 0 }, { count: 6, rate: 10 }],
    }
    expect(ProductCreditDefaultsSchema.safeParse(invalid).success).toBe(false)
  })
})

describe('ProductCreditDefaultsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateSetting.mockResolvedValue({ success: true })
    hookState = { settings: baseSettings(), isLoading: false, error: null, isSaving: false }
  })

  it('muestra los planes ya configurados en el sistema', () => {
    render(<ProductCreditDefaultsEditor />)

    // Los defaults traen 3, 6 y 12 cuotas.
    expect(screen.getByTestId('plan-row-3')).toBeInTheDocument()
    expect(screen.getByTestId('plan-row-6')).toBeInTheDocument()
    expect(screen.getByTestId('plan-row-12')).toBeInTheDocument()
  })

  it('permite editar el recargo de un plan existente', () => {
    render(<ProductCreditDefaultsEditor />)

    const rateInput = screen.getByLabelText('Recargo del plan de 6 cuotas')
    fireEvent.change(rateInput, { target: { value: '15' } })

    expect(screen.getByText('Sin guardar')).toBeInTheDocument()
    expect((rateInput as HTMLInputElement).value).toBe('15')
  })

  it('agrega y quita planes', () => {
    render(<ProductCreditDefaultsEditor />)

    expect(screen.queryByTestId('plan-row-9')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^9c$/ }))
    expect(screen.getByTestId('plan-row-9')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Quitar el plan de 3 cuotas'))
    expect(screen.queryByTestId('plan-row-3')).not.toBeInTheDocument()
  })

  it('guarda un payload que pasa el esquema de validación', async () => {
    render(<ProductCreditDefaultsEditor />)

    fireEvent.change(screen.getByLabelText('Recargo del plan de 6 cuotas'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }))

    await waitFor(() => expect(updateSetting).toHaveBeenCalledTimes(1))

    const [key, value] = updateSetting.mock.calls[0]
    expect(key).toBe('product_credit_defaults')
    expect(ProductCreditDefaultsSchema.safeParse(value).success).toBe(true)
    expect(value.plans.find((plan: { count: number }) => plan.count === 6).rate).toBe(15)
  })

  it('recorta valores fuera de rango antes de guardar', async () => {
    render(<ProductCreditDefaultsEditor />)

    // 250% de entrega inicial no tiene sentido: el maximo es 90.
    fireEvent.change(screen.getByLabelText('Entrega inicial (%)'), { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }))

    await waitFor(() => expect(updateSetting).toHaveBeenCalledTimes(1))
    const value = updateSetting.mock.calls[0][1]
    expect(value.downPaymentPercent).toBe(90)
    expect(ProductCreditDefaultsSchema.safeParse(value).success).toBe(true)
  })

  it('cambiar la base de venta a costo cambia los importes mostrados', () => {
    render(<ProductCreditDefaultsEditor />)

    // Con base "venta" el ejemplo es 1.000.000; con "costo" es 600.000.
    expect(screen.getByText(/Base usada: Precio de venta/)).toBeInTheDocument()
    const saleRow = within(screen.getByTestId('plan-row-3')).getAllByText(/\d/)
    const saleAmount = saleRow.map((n) => n.textContent).join(' ')

    fireEvent.click(screen.getByRole('button', { name: /Precio de costo/ }))

    expect(screen.getByText(/Base usada: Precio de costo/)).toBeInTheDocument()
    const costRow = within(screen.getByTestId('plan-row-3')).getAllByText(/\d/)
    const costAmount = costRow.map((n) => n.textContent).join(' ')

    expect(costAmount).not.toBe(saleAmount)
  })

  it('con base "costo" ofrece el margen en vez del respeto a la oferta', () => {
    render(<ProductCreditDefaultsEditor />)

    expect(screen.getByLabelText('Respetar el precio de oferta')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Precio de costo/ }))

    expect(screen.queryByLabelText('Respetar el precio de oferta')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Margen sobre el costo (%)')).toBeInTheDocument()
  })

  it('descarta los cambios sin guardar', () => {
    render(<ProductCreditDefaultsEditor />)

    fireEvent.change(screen.getByLabelText('Recargo del plan de 6 cuotas'), { target: { value: '99' } })
    expect(screen.getByText('Sin guardar')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Descartar/i }))

    expect(screen.queryByText('Sin guardar')).not.toBeInTheDocument()
    expect((screen.getByLabelText('Recargo del plan de 6 cuotas') as HTMLInputElement).value).toBe('10')
  })

  it('avisa en vez de romper cuando el usuario no es administrador', () => {
    hookState = { settings: null, isLoading: false, error: '403 Forbidden', isSaving: false }

    render(<ProductCreditDefaultsEditor />)

    expect(screen.getByText(/Necesitás rol de administrador/i)).toBeInTheDocument()
  })

  it('sin planes muestra el estado vacío en vez de una tabla rota', () => {
    const settings = baseSettings()
    settings.product_credit_defaults!.plans = []
    hookState.settings = settings

    render(<ProductCreditDefaultsEditor />)

    expect(screen.getByText(/Sin planes configurados/i)).toBeInTheDocument()
  })
})
