import { readFileSync } from 'node:fs'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ customer: null as null | { id: string; name: string }, canEdit: true }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
vi.mock('@/app/dashboard/pos/contexts/POSCustomerContext', () => ({ usePOSCustomer: () => ({ activeCustomer: state.customer, refreshCustomers: vi.fn() }) }))
vi.mock('@/hooks/use-credit-system', () => ({ useCreditSystem: () => ({ loadCreditData: vi.fn() }) }))
vi.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ hasPermission: () => state.canEdit }) }))

import { DraftNumberInput } from '@/components/ui/draft-number-input'
import { minimumCreditDownPayment } from '@/app/dashboard/pos/lib/cart-credit-plans'
import { CheckoutProvider, useCheckout } from '@/app/dashboard/pos/contexts/CheckoutContext'
import { PaymentMethods } from '@/app/dashboard/pos/components/checkout/PaymentMethods'

const gs = (n: number) => `Gs. ${Math.round(n).toLocaleString('es-PY')}`

function Controlled({ initial, min, max, decimals }: { initial: number; min?: number; max?: number; decimals?: boolean }) {
  const [value, setValue] = useState(initial)
  return <><DraftNumberInput aria-label="campo" value={value} onValueChange={setValue} min={min} max={max} decimals={decimals} /><output>{value}</output></>
}

describe('campos numéricos sin el 0 o el 1 pegado', () => {
  it('se puede borrar y escribir 12 cuotas desde cero', () => {
    render(<Controlled initial={1} min={1} max={60} />)
    const input = screen.getByLabelText('campo')
    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveValue('')
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.change(input, { target: { value: '12' } })
    expect(input).toHaveValue('12')
    expect(screen.getByRole('status')).toHaveTextContent('12')
  })

  it('al salir vacío vuelve al mínimo y lo que se pasa del máximo se recorta', () => {
    render(<Controlled initial={6} min={1} max={60} />)
    const input = screen.getByLabelText('campo')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(input).toHaveValue('1')
    fireEvent.change(input, { target: { value: '99' } })
    fireEvent.blur(input)
    expect(input).toHaveValue('60')
  })

  it('el interés acepta decimales con coma', () => {
    render(<Controlled initial={0} min={0} decimals />)
    const input = screen.getByLabelText('campo')
    fireEvent.change(input, { target: { value: '1,5' } })
    expect(screen.getByRole('status')).toHaveTextContent('1.5')
  })

  it('no acepta letras', () => {
    render(<Controlled initial={3} min={1} />)
    fireEvent.change(screen.getByLabelText('campo'), { target: { value: '3a' } })
    expect(screen.getByLabelText('campo')).toHaveValue('3')
  })
})

describe('adelanto mínimo para entrar en el crédito', () => {
  it('sin interés: lo que falta para llegar al disponible', () => {
    expect(minimumCreditDownPayment(1_500_000, 1_000_000, 0)).toBe(500_000)
  })
  it('con interés el resto financiado, más su interés, entra en el disponible', () => {
    const minimum = minimumCreditDownPayment(1_200_000, 1_000_000, 12)!
    const financed = 1_200_000 - minimum
    expect(Math.round(financed * 1.12)).toBeLessThanOrEqual(1_000_000)
  })
  it('si ya alcanza o no hay disponible, no hace falta / no hay forma', () => {
    expect(minimumCreditDownPayment(500_000, 1_000_000, 0)).toBeNull()
    expect(minimumCreditDownPayment(500_000, 0, 0)).toBeNull()
  })
})

function Pay(props: { total: number; canUseCredit: boolean; available?: number; used?: number; overdue?: number }) {
  return (
    <PaymentMethods
      cartTotal={props.total}
      canUseCredit={props.canUseCredit}
      creditSummary={props.available === undefined ? undefined : { availableCredit: props.available, usedCredit: props.used ?? 0, overdueAmount: props.overdue ?? 0 }}
      formatCurrency={gs}
      currency="PYG"
      setShowCreditHistory={vi.fn()}
    />
  )
}

function PickCredit() {
  const { setPaymentMethod } = useCheckout()
  return <button type="button" onClick={() => setPaymentMethod('credit')}>elegir crédito</button>
}

describe('cobro en el POS', () => {
  it('«Limpiar» deja el efectivo vacío para escribir otro monto (antes volvía al total)', () => {
    render(<CheckoutProvider><Pay total={85_000} canUseCredit={false} /></CheckoutProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Efectivo/ }))
    const input = screen.getByPlaceholderText('0')
    expect(input).toHaveValue('85.000')
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(input).toHaveValue('')
    fireEvent.change(input, { target: { value: '100.000' } })
    expect(input).toHaveValue('100.000')
    expect(screen.getByText('Gs. 15.000')).toBeInTheDocument()
  })

  it('con crédito insuficiente propone el adelanto mínimo y avisa las cuotas vencidas', () => {
    state.customer = { id: 'c1', name: 'Ana' }
    render(<CheckoutProvider><PickCredit /><Pay total={1_500_000} canUseCredit={false} available={1_000_000} used={200_000} overdue={150_000} /></CheckoutProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'elegir crédito' }))
    expect(screen.getByText(/tiene Gs\. 150\.000 en cuotas vencidas/)).toBeInTheDocument()
    expect(screen.getByText('Con un adelanto puede llevarlo a crédito')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Usar el mínimo/ }))
    expect(screen.getByRole('button', { name: 'Aplicar adelanto' })).toBeEnabled()
    state.customer = null
  })

  it('sin permiso para cambiar límites no ofrece los atajos de «Habilitar crédito»', () => {
    state.customer = { id: 'c1', name: 'Ana' }
    state.canEdit = false
    render(<CheckoutProvider><PickCredit /><Pay total={500_000} canUseCredit={false} available={0} used={0} /></CheckoutProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'elegir crédito' }))
    expect(screen.queryByRole('button', { name: /Habilitar/ })).not.toBeInTheDocument()
    expect(screen.getByText(/pedile a un administrador/)).toBeInTheDocument()
    state.customer = null
    state.canEdit = true
  })

  it('el «Requerido» es lo financiado con interés', () => {
    const source = readFileSync('src/app/dashboard/pos/components/checkout/PaymentMethods.tsx', 'utf8')
    expect(source).toContain('formatCurrency(fullCreditPlan.financedTotal)')
  })
})
