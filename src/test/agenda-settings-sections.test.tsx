import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { agendaDraftSnapshot, openingSummary } from '@/components/dashboard/agenda/AgendaSettingsPanel'
import { professionalServicesLabel, sortProfessionals } from '@/components/dashboard/agenda/ProfessionalsManager'
import { professionalInitials } from '@/components/dashboard/agenda/ProfessionalPhotoButton'
import type { AgendaProfessional, AgendaService, AgendaSettings } from '@/lib/agenda/agenda-server'

const settings: AgendaSettings = {
  slot_minutes: 30,
  opening_hours: { 1: [['09:00', '20:00']], 6: [['09:00', '13:00']] },
  online_booking: true,
  require_confirmation: false,
  min_notice_minutes: 60,
  max_days_ahead: 30,
  booking_message: null,
  notify_email: true,
}
const service = (id: string): AgendaService => ({ product_id: id, name: id, price: 1, hide_price: false, duration_minutes: 30, online: true, configured: true })
const pro = (patch: Partial<AgendaProfessional>): AgendaProfessional => ({ id: 'p', name: 'Juan', color: '#000000', phone: null, is_active: true, sort_order: 0, ...patch })

describe('configuración de la agenda por secciones', () => {
  it('resume el horario en el menú de secciones', () => {
    expect(openingSummary(settings)).toBe('Lun · Sáb · cada 30 min')
    expect(openingSummary({ ...settings, opening_hours: {} })).toBe('Sin días de atención')
  })

  it('detecta cambios sin guardar del horario y de los servicios, no del equipo', () => {
    const base = { settings, services: [service('a')] }
    const saved = agendaDraftSnapshot(base, false)
    expect(agendaDraftSnapshot({ ...base }, false)).toBe(saved)
    expect(agendaDraftSnapshot({ settings: { ...settings, slot_minutes: 15 }, services: base.services }, false)).not.toBe(saved)
    expect(agendaDraftSnapshot({ settings, services: [{ ...service('a'), online: false }] }, false)).not.toBe(saved)
  })

  it('avisa antes de salir con cambios sin guardar', () => {
    const panel = readFileSync(resolve(process.cwd(), 'src/components/dashboard/agenda/AgendaSettingsPanel.tsx'), 'utf8')
    expect(panel).toContain("window.addEventListener('beforeunload', warn)")
    expect(panel).toContain("window.addEventListener('hashchange', sync)")
  })
})

describe('Quién atiende', () => {
  const services = [service('a'), service('b'), service('c')]

  it('dice qué hace cada uno en una línea', () => {
    expect(professionalServicesLabel(pro({ service_ids: [] }), services)).toBe('Todos los servicios')
    expect(professionalServicesLabel(pro({ service_ids: ['a'] }), services)).toBe('1 de 3 servicios')
    expect(professionalServicesLabel(pro({ service_ids: ['a', 'b', 'c'] }), services)).toBe('Todos los servicios')
    // Un servicio que ya no existe no cuenta.
    expect(professionalServicesLabel(pro({ service_ids: ['a', 'borrado'] }), services)).toBe('1 de 3 servicios')
  })

  it('ordena como la agenda: por orden y después por nombre', () => {
    const list = sortProfessionals([pro({ id: '1', name: 'Zoe', sort_order: 1 }), pro({ id: '2', name: 'Ana', sort_order: 1 }), pro({ id: '3', name: 'Beto', sort_order: 0 })])
    expect(list.map((item) => item.name)).toEqual(['Beto', 'Ana', 'Zoe'])
  })

  it('muestra iniciales mientras no hay foto', () => {
    expect(professionalInitials('Juan Pérez')).toBe('JP')
    expect(professionalInitials('  lucas ')).toBe('L')
  })
})

describe('tamaño táctil', () => {
  it('los interruptores y casillas no se deforman a 44×44 en el celular', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/accessibility.css'), 'utf8')
    expect(css).toContain('button:not([role="switch"]):not([role="checkbox"]):not([role="radio"])')
  })
})
