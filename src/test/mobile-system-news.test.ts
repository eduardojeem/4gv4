import { describe, expect, it } from 'vitest'
import { newerPublishedRelease, eligibleNewsRecipients } from '@/lib/mobile/system-news'
import { resolveNotificationDefaultPreference } from '@/lib/notifications/defaults'
import { resolveNotificationRoute } from '@/lib/notifications/routes'
describe('Novedades móviles',()=>{
 it('no confunde 1.10.0 con 1.9.0',()=>{
  expect(newerPublishedRelease('1.9.0',{version:'1.10.0',storeUrl:'https://play.google.com/store/apps/details?id=com.mitiendapy.app'},'android')).not.toBeNull()
 })
 it('no inventa actualización sin tienda o versión válida',()=>{
  expect(newerPublishedRelease('1.1.0',null,'ios')).toBeNull()
  expect(newerPublishedRelease('1.1.0',{version:'2.0.0',storeUrl:'javascript:alert(1)'},'ios')).toBeNull()
  expect(newerPublishedRelease('1.1.0',{version:'1.1.0',storeUrl:'https://apps.apple.com/app/id123'},'ios')).toBeNull()
 })
 it('push de novedades empieza apagado',()=>{
  expect(resolveNotificationDefaultPreference('SYSTEM_NEWS','owner')).toEqual({pushEnabled:false,inAppEnabled:true})
 })
 it('abre la pantalla correcta sin aceptar URLs externas',()=>{
  expect(resolveNotificationRoute({type:'SYSTEM_NEWS',resourceType:'global_announcement',resourceId:'a1'})).toBe('/panel/system-news')
 })
 it('solo considera opt-in previo al aviso y respeta la audiencia',()=>{
  const announcement={target:'specific',target_org_ids:['org1'],sent_at:'2026-11-08T12:00:00Z'}
  const prefs=[{organization_id:'org1',user_id:'u1',push_enabled:true,updated_at:'2026-11-01T12:00:00Z'},{organization_id:'org2',user_id:'u2',push_enabled:true,updated_at:'2026-11-01T12:00:00Z'},{organization_id:'org1',user_id:'u3',push_enabled:false,updated_at:'2026-11-01T12:00:00Z'},{organization_id:'org1',user_id:'u4',push_enabled:true,updated_at:'2026-11-09T12:00:00Z'}]
  expect(eligibleNewsRecipients(announcement,prefs)).toEqual([{organizationId:'org1',userIds:['u1']}])
 })
})
