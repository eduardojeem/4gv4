import { describe,expect,it,vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}))
vi.mock('@/lib/api/withTenantAuth',()=>({withTenantAuth:(_options:unknown,handler:(r:Request,c:unknown)=>Promise<Response>)=>(r:Request)=>handler(r,{organization:{id:'org',role:'owner'},user:{id:'actor'}})}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:mocks.from})}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({rpc:mocks.rpc})}))
vi.mock('@/lib/agenda/agenda-server',async(importOriginal)=>({ ...await importOriginal<typeof import('@/lib/agenda/agenda-server')>(),loadAgendaConfig:async()=>({capabilities:{professionalBooking:true}})}))
vi.mock('@/lib/logger',()=>({logger:{error:vi.fn()}}))
import { POST } from '@/app/api/agenda/route'
import { PUT as saveSettings } from '@/app/api/agenda/settings/route'
import { PUT as replaceServices } from '@/app/api/agenda/professionals/route'
describe('internal transactional appointments',()=>{
  it('delegates terms to the server RPC and sends the authenticated actor',async()=>{
    const q={select:()=>q,eq:()=>q,insert:()=>q,maybeSingle:async()=>({data:{id:'owned'},error:null}),single:async()=>({data:{id:'legacy',price:1},error:null})}
    mocks.from.mockReturnValue(q)
    mocks.rpc.mockResolvedValue({data:{id:'appointment',price:40000},error:null})
    const body={customer_name:'Cliente',service_product_id:'11111111-1111-4111-8111-111111111111',professional_id:'22222222-2222-4222-8222-222222222222',service_name:'Corte',price:1,starts_at:'2026-10-10T09:00:00Z',duration_minutes:5}
    const response=await POST(new NextRequest('http://x/api/agenda',{method:'POST',body:JSON.stringify(body)}))
    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith('save_agenda_appointment',expect.objectContaining({p_org:'org',p_id:null,p_actor:'actor'}))
    expect((await response.json()).appointment.price).toBe(40000)
  })
  it('saves settings and terms with one privileged transaction',async()=>{
    mocks.rpc.mockClear()
    const q={upsert:()=>q,then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({error:null}).then(resolve)}
    mocks.from.mockReturnValue(q)
    mocks.rpc.mockResolvedValue({data:null,error:null})
    const body={slot_minutes:30,opening_hours:{'1':[['08:00','18:00']]},online_booking:true,require_confirmation:true,min_notice_minutes:60,max_days_ahead:30,professional_selection:'required',services:[]}
    const response=await saveSettings(new NextRequest('http://x/api/agenda/settings',{method:'PUT',body:JSON.stringify(body)}))
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('save_agenda_settings',expect.objectContaining({p_org:'org',p_actor:'actor',p_settings:expect.objectContaining({professional_selection:'required'})}))
  })
  it('replaces professional eligibility in one transaction',async()=>{
    mocks.rpc.mockClear()
    const q={select:()=>q,eq:()=>q,delete:()=>q,insert:()=>q,maybeSingle:async()=>({data:{id:'owned'},error:null}),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({error:null}).then(resolve)}
    mocks.from.mockReturnValue(q)
    mocks.rpc.mockResolvedValue({data:{id:'professional',service_ids:[]},error:null})
    const id='11111111-1111-4111-8111-111111111111'
    expect((await replaceServices(new NextRequest('http://x/api/agenda/professionals',{method:'PUT',body:JSON.stringify({id,service_ids:[]})}))).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('replace_agenda_professional_services',expect.objectContaining({p_org:'org',p_prof:id,p_services:[],p_actor:'actor'}))
  })
})
