import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { imeiWarning, isValidImei } from '@/lib/repairs/imei'
import { buildRepairUpdate } from '@/lib/repairs/repair-update'
import { useRepairFilters } from '@/hooks/use-repair-filters'
import type { Repair } from '@/types/repairs'

describe('IMEI', () => {
  it('reconoce un IMEI válido por su dígito de control, con o sin espacios', () => {
    expect(isValidImei('490154203237518')).toBe(true)
    expect(isValidImei('35 209900 176148 1')).toBe(true)
    expect(isValidImei('490154203237519')).toBe(false)
  })

  it('avisa solo cuando parece un IMEI mal cargado; una serie no es un error', () => {
    expect(imeiWarning('490154203237518')).toBeNull()
    expect(imeiWarning('490154203237519')).toMatch(/no es válido/)
    expect(imeiWarning('49015420323751')).toMatch(/14 dígitos/)
    expect(imeiWarning('C02XK1JHJG5J')).toBeNull()
    expect(imeiWarning('')).toBeNull()
    expect(imeiWarning(null)).toBeNull()
  })
})

describe('editar una reparación', () => {
  it('guarda el IMEI que se agrega o corrige después de recibir el equipo', () => {
    expect(buildRepairUpdate({ serialNumber: ' 490154203237518 ' })).toMatchObject({ serial_number: '490154203237518' })
    expect(buildRepairUpdate({ serial_number: 'SN-1' })).toMatchObject({ serial_number: 'SN-1' })
  })

  it('vaciar el campo borra el IMEI; no mandarlo no lo toca', () => {
    expect(buildRepairUpdate({ serialNumber: null })).toMatchObject({ serial_number: null })
    expect(buildRepairUpdate({ serialNumber: '   ' })).toMatchObject({ serial_number: null })
    expect(buildRepairUpdate({ status: 'listo' })).not.toHaveProperty('serial_number')
  })

  it('sigue guardando los demás campos como antes', () => {
    expect(buildRepairUpdate({ brand: 'Samsung', accessType: 'pin', accessPassword: '1234' })).toMatchObject({
      device_brand: 'Samsung', access_type: 'pin', access_password: '1234',
    })
  })
})

describe('buscar reparaciones', () => {
  afterEach(() => { vi.useRealTimers() })

  const repair = (over: Partial<Repair>): Repair => ({
    id: 'r1', ticketNumber: 'R-1001', device: 'Samsung A05', brand: 'Samsung', model: 'A05', issue: 'No carga',
    customer: { name: 'Ana' }, status: 'recibido', priority: 'medium', createdAt: '2026-10-01T10:00:00Z',
    ...over,
  } as unknown as Repair)

  const search = (repairs: Repair[], term: string) => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useRepairFilters({ repairs }))
    act(() => { result.current.setSearchTerm(term) })
    act(() => { vi.advanceTimersByTime(400) })
    return result.current.filteredRepairs.map((item) => item.id)
  }

  it('encuentra el equipo por IMEI, aunque se escriba con espacios o solo una parte', () => {
    const repairs = [repair({ id: 'a', serialNumber: '352099001761481' }), repair({ id: 'b', serialNumber: '490154203237518' })]
    expect(search(repairs, '35 209900 176148 1')).toEqual(['a'])
    expect(search(repairs, '7518')).toEqual(['b'])
  })

  it('encuentra por la falla, como promete el buscador', () => {
    const repairs = [repair({ id: 'a', issue: 'Pantalla rota' }), repair({ id: 'b', issue: 'No carga' })]
    expect(search(repairs, 'pantalla')).toEqual(['a'])
  })
})
