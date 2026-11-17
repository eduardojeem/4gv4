import {describe,it,expect} from 'vitest'
import {parseRepairLookup,repairLookupError,repairTrackingStatus} from '../../mobile/src/lib/repair-tracking-model'
describe('seguimiento QR móvil',()=>{
 const base='https://mitiendapy.com'
 it('interpreta QR firmado por comercio, raíz y formato anterior',()=>{
  for(const path of ['/tienda/mis-reparaciones/R-2026-00042','/mis-reparaciones/R-2026-00042','/mis-reparaciones?ticket=R-2026-00042']){
   expect(parseRepairLookup(base+path+(path.includes('?')?'&':'?')+'verify=abcdef0123456789',base)).toMatchObject({ticket:'R-2026-00042',verify:'abcdef0123456789'})
  }
  expect(parseRepairLookup(base+'/tienda/mis-reparaciones/R-2026-00042?verify=abcdef0123456789',base)?.organizationSlug).toBe('tienda')
 })
 it('acepta ticket manual pero rechaza enlaces ajenos, firmas rotas y textos arbitrarios',()=>{
  expect(parseRepairLookup('rep-000042',base)).toEqual({ticket:'REP-000042'})
  for(const input of ['1045','https://ajeno.test/mis-reparaciones/REP-42?verify=abcdef0123456789',base+'/mis-reparaciones/REP-42?verify=rota','javascript:alert(1)'])expect(parseRepairLookup(input,base)).toBeNull()
 })
 it('distingue inexistente, enlace inválido, intentos y servidor',()=>{
  expect(repairLookupError(404,true)).toMatch(/No encontramos/)
  expect(repairLookupError(401,false)).toMatch(/teléfono o email/)
  expect(repairLookupError(403,true)).toMatch(/QR/)
  expect(repairLookupError(429,false)).toMatch(/Esperá/)
  expect(repairLookupError(503,false)).toMatch(/disponible/)
 })
 it('distingue pausa y cancelación, sin inventar recibido ante un estado desconocido',()=>{
  expect(repairTrackingStatus('pausado')).toMatchObject({label:'En pausa',step:2,tone:'warning'})
  expect(repairTrackingStatus('cancelado')).toMatchObject({label:'Cancelada',step:null})
  expect(repairTrackingStatus('nuevo_estado')).toMatchObject({label:'Estado por confirmar',step:null})
 })
})
