import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appointmentCode, appointmentRow } from '@/lib/agenda/agenda-api'
import { appointmentWhen, buildAppointmentWhatsApp } from '@/lib/agenda/messages'
import { useQuoteToCart } from '@/app/dashboard/pos/hooks/useQuoteToCart'
import type { Product } from '@/app/dashboard/pos/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

afterEach(() => vi.unstubAllGlobals())

describe('turnos', () => {
  it('el fin del turno sale de la duración', () => {
    const row = appointmentRow({
      customer_name: 'Ana', service_name: 'Corte', price: 50000,
      starts_at: '2026-10-15T12:30:00.000Z', duration_minutes: 45,
    })
    expect(row.ends_at).toBe('2026-10-15T13:15:00.000Z')
    expect(row.professional_id).toBeNull()
    expect(appointmentCode(42)).toBe('T-00042')
  })

  it('arma los mensajes de WhatsApp con la hora local', () => {
    expect(appointmentWhen('2026-10-15T12:30:00.000Z', 'America/Asuncion')).toBe('jueves 15/10 a las 09:30')
    const confirm = buildAppointmentWhatsApp('confirm', {
      storeName: 'Barbería Sur', customerName: 'Ana María López', serviceName: 'Corte', startsAt: '2026-10-15T12:30:00.000Z',
      timeZone: 'America/Asuncion', professionalName: 'Luis', url: 'https://www.mitiendapy.com/turno/abc',
    })
    expect(confirm).toContain('Hola Ana!')
    expect(confirm).toContain('jueves 15/10 a las 09:30')
    expect(confirm).toContain('Corte con Luis')
    expect(confirm).toContain('https://www.mitiendapy.com/turno/abc')
    expect(buildAppointmentWhatsApp('reminder', { storeName: 'X', customerName: 'Ana', serviceName: 'Corte', startsAt: '2026-10-15T12:30:00.000Z', timeZone: 'America/Asuncion' }))
      .toContain('Respondé este mensaje para confirmar')
  })
})

describe('migración de la agenda', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261009120000_agenda_appointments.sql'), 'utf8')

  it('todas las tablas tienen RLS y los clientes no ven turnos', () => {
    for (const table of ['agenda_settings', 'agenda_professionals', 'agenda_services', 'appointments']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
    }
    expect(sql).toMatch(/appointments_staff_read[\s\S]*<> 'customer'/)
  })

  it('el trigger impide dos turnos superpuestos, con candado', () => {
    expect(sql).toMatch(/check_appointment_overlap[\s\S]*pg_advisory_xact_lock[\s\S]*tstzrange\(other\.starts_at, other\.ends_at\) && tstzrange\(new\.starts_at, new\.ends_at\)/)
    expect(sql).toContain("raise exception 'APPOINTMENT_OVERLAP'")
  })
})

describe('turno → POS', () => {
  const product = { id: 'svc-1', name: 'Corte', sale_price: 60000, wholesale_price: null, stock_quantity: 0, is_active: true } as unknown as Product

  it('carga el servicio con el precio del turno y, al cobrar, lo deja atendido', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ appointment: { id: 'a1', number: 7, status: 'confirmed', sale_id: null, customer_id: 'c1', service_product_id: 'svc-1', service_name: 'Corte', price: 50000 } }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const calls = { addProduct: vi.fn(), updateItemDiscount: vi.fn(), setSelectedCustomer: vi.fn() }

    const hook = renderHook(() => useQuoteToCart({
      quoteId: null,
      appointmentId: 'a1',
      ready: true,
      inventoryProducts: [product],
      getVariant: () => null,
      addProduct: calls.addProduct,
      addVariant: vi.fn(),
      updateItemDiscount: calls.updateItemDiscount,
      setIsWholesale: vi.fn(),
      setSelectedCustomer: calls.setSelectedCustomer,
      clearCart: vi.fn(),
    }))

    await waitFor(() => expect(hook.result.current.activeQuote).toEqual({ kind: 'appointment', id: 'a1', number: 7, code: 'T-00007' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/agenda/a1', expect.anything())
    expect(calls.addProduct).toHaveBeenCalledWith(product, 1)
    expect(calls.setSelectedCustomer).toHaveBeenCalledWith('c1')
    // El catálogo dice 60.000 y el turno se dio a 50.000.
    expect(calls.updateItemDiscount).toHaveBeenCalledWith('svc-1', expect.closeTo(16.6667, 3))

    await act(() => hook.result.current.markConverted('sale-1'))
    expect(fetchMock).toHaveBeenLastCalledWith('/api/agenda/a1', expect.objectContaining({ body: JSON.stringify({ action: 'link_sale', sale_id: 'sale-1' }) }))
  })

  it('no carga un turno ya cobrado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ appointment: { id: 'a1', number: 7, status: 'completed', sale_id: 's9', customer_id: null, service_product_id: 'svc-1', service_name: 'Corte', price: 50000 } }),
    }))
    const addProduct = vi.fn()
    const hook = renderHook(() => useQuoteToCart({
      quoteId: null, appointmentId: 'a1', ready: true, inventoryProducts: [product], getVariant: () => null,
      addProduct, addVariant: vi.fn(), updateItemDiscount: vi.fn(), setIsWholesale: vi.fn(), setSelectedCustomer: vi.fn(), clearCart: vi.fn(),
    }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(addProduct).not.toHaveBeenCalled()
    expect(hook.result.current.activeQuote).toBeNull()
  })
})
