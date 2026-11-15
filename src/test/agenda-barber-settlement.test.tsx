import { addDays, todayIn, weekdayOf } from '@/lib/agenda/time'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BarberSettlementDialog } from '@/components/dashboard/agenda/BarberSettlementDialog'
import type { AgendaProfessional } from '@/lib/agenda/agenda-server'

const today = todayIn('America/Asuncion')
const monday = addDays(today, weekdayOf(today) === 0 ? -6 : 1 - weekdayOf(today))
const sunday = addDays(monday, 6)
const mockProfessionals: AgendaProfessional[] = [
  {
    id: 'prof-juan',
    name: 'Juan Barber',
    color: '#e11d48',
    is_active: true,
    remuneration_type: 'commission',
    commission_rate_services: 50,
    commission_rate_products: 10,
    commission_fixed_deduction: 5000,
  },
]

describe('Liquidación de comisiones de barberos y guardado persistente', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn())
  })

  it('guarda el pago de liquidación en la API y muestra el comprobante oficial', async () => {
    let capturedBody: unknown = null

    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/agenda?date=')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            appointments: [
              {
                id: 'apt-1',
                customer_name: 'Lucas Galeano',
                service_name: 'Corte Clásico',
                price: 50000,
                professional_id: 'prof-juan',
                starts_at: '2026-11-12T14:00:00Z',
                status: 'completed',
              },
              {
                id: 'apt-2',
                customer_name: 'Mateo Ortiz',
                service_name: 'Perfilado Barba',
                price: 30000,
                professional_id: 'prof-juan',
                starts_at: '2026-11-12T15:00:00Z',
                status: 'completed',
              },
            ],
          }),
        })
      }

      if (url.includes('/api/agenda/settlements') && options?.method === 'POST') {
        capturedBody = JSON.parse(options.body as string)
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            settlement: {
              id: 'settlement-123',
              receipt_code: 'LIQ-261112-JUA-999',
              net_amount: 30000,
              payment_method: 'cash',
              status: 'paid',
            },
            cashMovementCreated: true,
          }),
        })
      }

      if (url.includes('/api/agenda/settlements')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            settlements: [],
            migrationPending: false,
          }),
        })
      }

      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    vi.stubGlobal('fetch', fetchMock)

    const onOpenChange = vi.fn()

    render(
      <BarberSettlementDialog
        open={true}
        onOpenChange={onOpenChange}
        professionals={mockProfessionals}
        defaultProfessionalId="prof-juan"
        currency="PYG"
      />
    )

    // Esperar a que cargue el desglose
    await waitFor(() => {
      expect(screen.getByText('Liquidación de comisiones')).toBeInTheDocument()
      expect(screen.getByText('Servicios atendidos')).toBeInTheDocument()
      expect(screen.getByText('Lucas Galeano')).toBeInTheDocument()
    })

    // Click en Registrar Pago
    const reviewBtn = screen.getByRole('button', { name: 'Revisar pago' })
    fireEvent.click(reviewBtn)
    expect(capturedBody).toBeNull()
    const payBtn = screen.getByRole('button', { name: /Confirmar y registrar pago/i })
    expect(payBtn).toBeEnabled()
    fireEvent.click(payBtn)

    // Verificar que se haya enviado a la API
    await waitFor(() => {
      expect(capturedBody).not.toBeNull()
      expect((capturedBody as { professionalName: string }).professionalName).toBe('Juan Barber')
      expect((capturedBody as { paymentMethod: string }).paymentMethod).toBe('cash')
    })

    // Debe mostrar la tarjeta de comprobante liquidado
    await waitFor(() => {
      expect(screen.getByText(/Pago registrado/i)).toBeInTheDocument()
      expect(screen.getAllByText('LIQ-261112-JUA-999').length).toBeGreaterThan(0)
    })
  })

  it('permite ver el historial de liquidaciones anteriores', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/agenda/settlements')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            settlements: [
              {
                id: 'sett-1',
                professional_name: 'Juan Barber',
                receipt_code: 'LIQ-261110-JUA-501',
                period_from: '2026-11-03',
                period_to: '2026-11-08',
                appointments_count: 14,
                net_amount: 350000,
                payment_method: 'transfer',
                settled_at: '2026-11-08T20:00:00Z',
                status: 'paid',
              },
            ],
            migrationPending: false,
          }),
        })
      }

      return Promise.resolve({ ok: true, json: async () => ({ appointments: [] }) })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(
      <BarberSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        professionals={mockProfessionals}
        defaultProfessionalId="prof-juan"
        currency="PYG"
      />
    )

    // Click en pestaña "Historial"
    const historyTab = screen.getByRole('button', { name: /Historial/i })
    fireEvent.click(historyTab)

    // Debe mostrar el comprobante anterior
    await waitFor(() => {
      expect(screen.getByText('LIQ-261110-JUA-501')).toBeInTheDocument()
      expect(screen.getByText(/14 servicios atendidos/i)).toBeInTheDocument()
    })
  })

  it('descuenta pagos previos registrados en el período y muestra período totalmente liquidado', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/agenda?date=')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            appointments: [
              {
                id: 'apt-1',
                customer_name: 'Lucas Galeano',
                service_name: 'Corte Clásico',
                price: 80000,
                professional_id: 'prof-juan',
                starts_at: '2026-11-12T14:00:00Z',
                status: 'completed',
              },
            ],
          }),
        })
      }

      if (url.includes('/api/agenda/settlements')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            settlements: [
              {
                id: 'sett-prev-1',
                professional_id: 'prof-juan',
                professional_name: 'Juan Barber',
                receipt_code: 'LIQ-261112-JUA-111',
                period_preset: 'this_week',
                period_from: monday,
                period_to: sunday,
                appointments_count: 1,
                net_amount: 35000, // 80k * 50% - 5000 = 35000 (totalmente cubierto)
                payment_method: 'cash',
                settled_at: '2026-11-12T10:00:00Z',
                status: 'paid',
              },
            ],
            migrationPending: false,
          }),
        })
      }

      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(
      <BarberSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        professionals={mockProfessionals}
        defaultProfessionalId="prof-juan"
        currency="PYG"
      />
    )

    // Debe detectar el pago previo y mostrar que el período está al día
    await waitFor(() => {
      expect(screen.getByText(/Período al día/i)).toBeInTheDocument()
      expect(screen.getByText('LIQ-261112-JUA-111')).toBeInTheDocument()
      expect(screen.getByText(/Comisión ya liquidada/i)).toBeInTheDocument()
    })
  })

  it('permite anular una liquidación previa desde el historial', async () => {
    let patchCalledWith: unknown = null
    vi.stubGlobal('confirm', () => true)

    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/agenda/settlements') && options?.method === 'PATCH') {
        patchCalledWith = JSON.parse(options.body as string)
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, message: 'Liquidación anulada correctamente' }),
        })
      }

      if (url.includes('/api/agenda/settlements')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            settlements: [
              {
                id: 'sett-cancel-me',
                professional_id: 'prof-juan',
                professional_name: 'Juan Barber',
                receipt_code: 'LIQ-CANCEL-999',
                period_preset: 'this_week',
                period_from: '2026-11-09',
                period_to: '2026-11-14',
                appointments_count: 2,
                net_amount: 50000,
                payment_method: 'cash',
                settled_at: '2026-11-12T10:00:00Z',
                status: 'paid',
              },
            ],
            migrationPending: false,
          }),
        })
      }

      return Promise.resolve({ ok: true, json: async () => ({ appointments: [] }) })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(
      <BarberSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        professionals={mockProfessionals}
        defaultProfessionalId="prof-juan"
        currency="PYG"
      />
    )

    // Ir a pestaña historial
    const historyTab = screen.getByRole('button', { name: /Historial/i })
    fireEvent.click(historyTab)

    await waitFor(() => {
      expect(screen.getByText('LIQ-CANCEL-999')).toBeInTheDocument()
    })

    // Click en botón Anular
    const anularBtn = screen.getByRole('button', { name: /Anular/i })
    fireEvent.click(anularBtn)
    fireEvent.change(screen.getByLabelText('Motivo de anulación'), {target:{value:'Pago por error'}})
    fireEvent.click(screen.getByRole('button',{name:'Confirmar anulación'}))

    await waitFor(() => {
      expect(patchCalledWith).toEqual({
        settlementId: 'sett-cancel-me',
        action: 'cancel',
        reason: 'Pago por error',
      })
    })
  })

  it('reconoce vales ya rendidos al reabrir el diálogo sin re-cobrar el monto del vale', async () => {
    const profSinDeduccion: AgendaProfessional[] = [
      {
        id: 'prof-juan',
        name: 'Juan Barber',
        color: '#e11d48',
        is_active: true,
        remuneration_type: 'commission',
        commission_rate_services: 50,
        commission_rate_products: 10,
        commission_fixed_deduction: 0,
      },
    ]

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/agenda?date=')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            appointments: [
              {
                id: 'apt-1',
                customer_name: 'Cliente 1',
                service_name: 'Corte',
                price: 100000,
                professional_id: 'prof-juan',
                starts_at: '2026-11-12T14:00:00Z',
                status: 'completed',
              },
              {
                id: 'apt-2',
                customer_name: 'Cliente 2',
                service_name: 'Corte',
                price: 105000,
                professional_id: 'prof-juan',
                starts_at: '2026-11-12T15:00:00Z',
                status: 'completed',
              },
            ],
          }),
        })
      }

      if (url.includes('/api/agenda/settlements')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            settlements: [
              {
                id: 'sett-vales-1',
                professional_id: 'prof-juan',
                professional_name: 'Juan Barber',
                receipt_code: 'LIQ-VALES-497',
                period_preset: 'this_week',
                period_from: monday,
                period_to: sunday,
                appointments_count: 2,
                total_billed: 205000,
                commission_rate: 50,
                commission_amount: 102500,
                deductions_amount: 0,
                advances_vales_amount: 100000,
                tips_amount: 0,
                net_amount: 2500, // Se pagó 2.500 en efectivo y se rindió 100.000 en vales
                payment_method: 'cash',
                settled_at: '2026-11-12T16:00:00Z',
                status: 'paid',
              },
            ],
            migrationPending: false,
          }),
        })
      }

      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(
      <BarberSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        professionals={profSinDeduccion}
        defaultProfessionalId="prof-juan"
        currency="PYG"
      />
    )

    // Al abrir con el input de vales en 0, debe reconocer que la comisión total (102.500 ₲) ya fue saldada
    await waitFor(() => {
      expect(screen.getByText(/Período al día/i)).toBeInTheDocument()
      expect(screen.getByText('LIQ-VALES-497')).toBeInTheDocument()
      expect(screen.getByRole('button',{name:'Revisar pago'})).toBeDisabled()
    })
  })

  it('detecta cortes nuevos agregados después de una liquidación previa y calcula saldo remanente', async () => {
    const profSinDeduccion: AgendaProfessional[] = [
      {
        id: 'prof-juan',
        name: 'Juan Barber',
        color: '#e11d48',
        is_active: true,
        remuneration_type: 'commission',
        commission_rate_services: 50,
        commission_rate_products: 10,
        commission_fixed_deduction: 0,
      },
    ]

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/agenda?date=')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            appointments: [
              {
                id: 'apt-1',
                customer_name: 'Cliente Viejo 1',
                service_name: 'Corte',
                price: 100000,
                professional_id: 'prof-juan',
                starts_at: '2026-11-12T14:00:00Z',
                status: 'completed',
              },
              {
                id: 'apt-2',
                customer_name: 'Cliente Viejo 2',
                service_name: 'Corte',
                price: 100000,
                professional_id: 'prof-juan',
                starts_at: '2026-11-12T15:00:00Z',
                status: 'completed',
              },
              // 3er corte agregado con posterioridad
              {
                id: 'apt-3',
                customer_name: 'Cliente Nuevo Posterior',
                service_name: 'Barba',
                price: 60000,
                professional_id: 'prof-juan',
                starts_at: '2026-11-12T17:00:00Z',
                status: 'completed',
              },
            ],
          }),
        })
      }

      if (url.includes('/api/agenda/settlements')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            settlements: [
              {
                id: 'sett-prev-2cuts',
                professional_id: 'prof-juan',
                professional_name: 'Juan Barber',
                receipt_code: 'LIQ-CIERRE-1',
                period_preset: 'this_week',
                period_from: monday,
                period_to: sunday,
                appointments_count: 2,
                total_billed: 200000,
                commission_rate: 50,
                commission_amount: 100000,
                deductions_amount: 0,
                advances_vales_amount: 0,
                tips_amount: 0,
                net_amount: 100000,
                payment_method: 'cash',
                settled_at: '2026-11-12T16:00:00Z',
                status: 'paid',
              },
            ],
            migrationPending: false,
          }),
        })
      }

      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(
      <BarberSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        professionals={profSinDeduccion}
        defaultProfessionalId="prof-juan"
        currency="PYG"
      />
    )

    // Debe detectar que 2 cortes ya están liquidados y que el 3er corte genera saldo pendiente de 30.000 ₲ (60k * 50%)
    await waitFor(() => {
      expect(screen.getByText(/Nuevos servicios atendidos/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Revisar pago' })).toBeEnabled()
      expect(screen.getByLabelText('Importe a pagar')).toHaveTextContent(/30\.000/)
    })
  })
})
it('no muestra el período al día ni oculta los ajustes cuando un adelanto supera el saldo',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes('/api/agenda?')?{appointments:[{id:'a',professional_id:'prof-juan',status:'completed',price:40000,customer_name:'Cliente',service_name:'Corte',starts_at:'2026-11-12T14:00:00Z'}]}:{success:true,settlements:[{id:'p',professional_id:'prof-juan',status:'paid',period_from:monday,period_to:sunday,net_amount:5000,advances_vales_amount:0,tips_amount:0,appointments_count:0}]}})))
 render(<BarberSettlementDialog open={true} onOpenChange={vi.fn()} professionals={mockProfessionals} currency="PYG"/>)
 const advances=await screen.findByLabelText('Adelantos a descontar')
 fireEvent.click(screen.getByText('Ajustes de este pago (opcional)'))
 fireEvent.change(advances,{target:{value:'11000'}})
 expect(screen.getByRole('alert')).toHaveTextContent(/superar el saldo/i)
 expect(screen.getByLabelText('Adelantos a descontar')).toBeInTheDocument()
 expect(screen.queryByText('Período al día')).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Revisar pago'})).toBeDisabled()
})
