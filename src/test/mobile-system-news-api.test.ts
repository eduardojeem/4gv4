// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks=vi.hoisted(()=>({from:vi.fn(),dispatch:vi.fn(),filters:[] as unknown[],lookup:null as null|{id:string}}))
vi.mock('@/lib/api/withTenantAuth',()=>({withTenantAuth:(_options:unknown,handler:(request:NextRequest,context:{user:{id:string};organization:{id:string}})=>Promise<Response>)=>(request:NextRequest)=>handler(request,{user:{id:'user-1'},organization:{id:'11111111-1111-4111-8111-111111111111'}})}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:mocks.from})}))
vi.mock('@/lib/notifications/server/dispatcher',()=>({dispatchNotificationEvent:mocks.dispatch}))
import { GET, POST } from '@/app/api/mobile/system-news/route'
import { dispatchPublishedSystemNews } from '@/lib/mobile/system-news-worker'
const id='22222222-2222-4222-8222-222222222222'
beforeEach(()=>{vi.clearAllMocks();mocks.filters=[];mocks.lookup=null})
function builder(table:string,rows:unknown[]=[]){
 const query={select:()=>query,eq:(...args:unknown[])=>{mocks.filters.push([table,'eq',...args]);return query},gte:()=>query,or:(value:string)=>{mocks.filters.push([table,'or',value]);return query},order:()=>query,limit:()=>query,range:()=>query,in:()=>query,maybeSingle:async()=>({data:mocks.lookup,error:null}),upsert:vi.fn().mockResolvedValue({error:null}),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(resolve({data:rows,error:null}))}
 return query
}
describe('Novedades: aislamiento y worker',()=>{
 it('consulta solo publicados de la audiencia y lecturas del usuario',async()=>{
  mocks.from.mockImplementation((table:string)=>builder(table,table==='global_notifications'?[{id,title:'Novedad',body:'Texto',type:'info',sent_at:'2026-11-01T12:00:00Z'}]:[]))
  const response=await GET(new NextRequest('http://localhost/api/mobile/system-news'))
  expect(response.status).toBe(200)
  expect(mocks.filters).toContainEqual(['global_notifications','eq','status','sent'])
  expect(mocks.filters).toContainEqual(['global_notifications','or','target.eq.all,target_org_ids.cs.{11111111-1111-4111-8111-111111111111}'])
  expect(mocks.filters).toContainEqual(['global_notification_reads','eq','user_id','user-1'])
 })
 it('rechaza leer un aviso no disponible sin escribir lecturas',async()=>{
  const queries:ReturnType<typeof builder>[]=[];mocks.from.mockImplementation((table:string)=>{const q=builder(table);queries.push(q);return q})
  const response=await POST(new NextRequest('http://localhost/api/mobile/system-news',{method:'POST',body:JSON.stringify({id,organizationId:'otra'})}))
  expect(response.status).toBe(404)
  expect(queries.every(q=>q.upsert.mock.calls.length===0)).toBe(true)
 })
 it('el worker no envía sin opt-in',async()=>{
  mocks.from.mockImplementation((table:string)=>builder(table))
  await dispatchPublishedSystemNews()
  expect(mocks.dispatch).not.toHaveBeenCalled()
 })
 it('usa destinatarios autorizados y una clave estable en reintentos',async()=>{
  const now=new Date().toISOString(),before=new Date(Date.now()-60000).toISOString()
  mocks.from.mockImplementation((table:string)=>builder(table,table==='notification_preferences'?[{organization_id:'org1',user_id:'u1',push_enabled:true,updated_at:before}]:[{id,target:'specific',target_org_ids:['org1'],sent_at:now}]))
  await dispatchPublishedSystemNews();await dispatchPublishedSystemNews()
  expect(mocks.dispatch).toHaveBeenCalledTimes(2)
  expect(mocks.dispatch.mock.calls[0][0]).toEqual(mocks.dispatch.mock.calls[1][0])
  expect(mocks.dispatch.mock.calls[0][0]).toMatchObject({organizationId:'org1',targetUserIds:['u1'],type:'SYSTEM_NEWS',idempotencyKey:`platform-news:${id}:org1`})
 })
})
