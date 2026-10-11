import { describe, expect, it } from 'vitest'
import { reservationReadiness } from '@/lib/agenda/reservation-readiness'
import { DEFAULT_AGENDA_SETTINGS, type AgendaProfessional, type AgendaService } from '@/lib/agenda/agenda-server'

const service = { product_id: 's', name: 'Manicura', online: true } as AgendaService
const pro = { id: 'p', name: 'Ana', is_active: true, online_visible: true, service_ids: [] } as unknown as AgendaProfessional
const settings = { ...DEFAULT_AGENDA_SETTINGS, online_booking: true, opening_hours: { 1: [['09:00','18:00'] as [string,string]] } }
describe('reservation configuration readiness', () => {
  it('does not treat an enabled switch as publication', () => {
    expect(reservationReadiness({settings, services:[service],professionals:[pro],professionalCount:1,storefrontPublic:false}).ready).toBe(false)
  })
  it('reports services with nobody eligible, including inactive or closed staff', () => {
    for (const professional of [{...pro,online_visible:false},{...pro,is_active:false},{...pro,service_ids:['other']},{...pro,opening_hours:{}}]) {
      expect(reservationReadiness({settings,services:[service],professionals:[professional],professionalCount:1,storefrontPublic:true}).uncovered).toEqual(['Manicura'])
    }
  })
  it('allows a single store agenda only when no staff exists and selection is not required', () => {
    expect(reservationReadiness({settings,services:[service],professionals:[],professionalCount:0,storefrontPublic:true}).ready).toBe(true)
    expect(reservationReadiness({settings:{...settings,professional_selection:'required'},services:[service],professionals:[],professionalCount:0,storefrontPublic:true}).ready).toBe(false)
  })
  it('requires real opening periods and at least one online service', () => {
    expect(reservationReadiness({settings:{...settings,opening_hours:{1:[]}},services:[service],professionals:[],professionalCount:0,storefrontPublic:true}).ready).toBe(false)
    expect(reservationReadiness({settings,services:[{...service,online:false}],professionals:[],professionalCount:0,storefrontPublic:true}).ready).toBe(false)
  })
})
