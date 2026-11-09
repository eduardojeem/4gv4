// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({insert:vi.fn(),push:vi.fn(),pref:vi.fn(),from:vi.fn()}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:mocks.from})}))
vi.mock('@/lib/notifications/server/recipients',()=>({resolveRecipients:async()=>({candidates:[{userId:'u1',role:'owner'}],eligible:[{userId:'u1',role:'owner'}],skippedByBranch:0,skippedByPermission:0})}))
vi.mock('@/lib/notifications/server/preferences',()=>({getBatchEffectiveNotificationPreferences:mocks.pref}))
vi.mock('@/lib/notifications/server/expo-push',()=>({sendExpoPushNotifications:mocks.push}))
import { dispatchNotificationEvent } from '@/lib/notifications/server/dispatcher'
beforeEach(()=>{
 vi.clearAllMocks()
 mocks.pref.mockResolvedValue(new Map([['u1',{pushEnabled:true,inAppEnabled:true}]]))
 mocks.push.mockResolvedValue({attempted:1,delivered:1,failed:0})
 mocks.from.mockImplementation((table:string)=>{
  if(table==='notifications')return {insert:()=>({select:()=>({single:mocks.insert})})}
  const query={select:()=>query,eq:()=>query,in:()=>query,then:(resolve:(data:unknown)=>unknown)=>Promise.resolve(resolve({data:[{user_id:'u1',push_token:'fake-token',app_version:'1.1.0'}],error:null}))};return query
 })
})
const send=()=>dispatchNotificationEvent({organizationId:'org1',type:'SYSTEM_NEWS',resourceId:'a1',idempotencyKey:'news:a1:org1'})
it('no envía push si no se pudo guardar la marca idempotente',async()=>{
 mocks.insert.mockResolvedValue({data:null,error:{code:'500',message:'Fallo simulado'}})
 await send();expect(mocks.push).not.toHaveBeenCalled()
})
it('un reintento con la misma marca no vuelve a enviar push',async()=>{
 mocks.insert.mockResolvedValueOnce({data:{id:'n1'},error:null}).mockResolvedValueOnce({data:null,error:{code:'23505',message:'duplicate key'}})
 await send();await send();expect(mocks.push).toHaveBeenCalledTimes(1)
})
it('respeta el opt-out al momento del envío',async()=>{
 mocks.pref.mockResolvedValue(new Map([['u1',{pushEnabled:false,inAppEnabled:true}]]))
 mocks.insert.mockResolvedValue({data:{id:'n1'},error:null})
 await send();expect(mocks.push).not.toHaveBeenCalled()
})
