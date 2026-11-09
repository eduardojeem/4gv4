import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}))
vi.mock('@/lib/mobile/system-news-worker',()=>({dispatchPublishedSystemNews:vi.fn().mockResolvedValue(undefined)}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>mocks}))
import { getCommunicationsData } from '@/lib/superadmin/communications'
import { validateGlobalNotification } from '@/lib/superadmin/notification-validation'
import { POST } from '@/app/api/cron/communications/route'
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks()})
describe('Consulta y publicación programada',()=>{
 it('consultar no publica y no cuenta pendientes como enviados',async()=>{
  mocks.from.mockImplementation((table:string)=>{
   let count=false
   const query={select:(_fields:string,options?:{count?:string})=>{count=Boolean(options?.count);return query},order:()=>query,limit:()=>query,range:()=>query,eq:()=>query,gte:()=>query,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(resolve({error:null,count:0,data:table==='communication_messages'&&!count?[{id:'pending',channel:'email',status:'queued',created_at:'2026-01-01'}]:[]}))}
   return query
  })
  const data=await getCommunicationsData()
  expect(mocks.rpc).not.toHaveBeenCalled()
  expect(data.channelStats).toEqual([{channel:'email',sent:0,failed:0,pending:1}])
 })
 it('permite conservar una programación existente pero no crear otra en el pasado',()=>{
  const payload={title:'Aviso',body:'Contenido editado',type:'info',target:'all',status:'scheduled',scheduled_at:'2000-01-01T12:00:00.000Z'}
  expect(validateGlobalNotification(payload,payload.scheduled_at).error).toBeNull()
  expect(validateGlobalNotification({...payload,scheduled_at:'2000-02-01T12:00:00.000Z'},payload.scheduled_at).error).not.toBeNull()
 })
 it('worker sin secreto no publica',async()=>{
  vi.stubEnv('CRON_SECRET','')
  expect((await POST(new Request('http://localhost/api/cron/communications',{method:'POST'}))).status).toBe(503)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it('worker sin autorización no publica',async()=>{
  vi.stubEnv('CRON_SECRET','local-test-only')
  expect((await POST(new Request('http://localhost/api/cron/communications',{method:'POST'}))).status).toBe(401)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it('worker autorizado publica una sola vez con RPC simulado',async()=>{
  vi.stubEnv('CRON_SECRET','local-test-only');mocks.rpc.mockResolvedValue({data:2,error:null})
  const response=await POST(new Request('http://localhost/api/cron/communications',{method:'POST',headers:{authorization:'Bearer local-test-only'}}))
  expect(await response.json()).toEqual({published:2})
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
 })
})
