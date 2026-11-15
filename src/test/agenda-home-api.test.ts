import {beforeEach,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'
const state=vi.hoisted(()=>({ready:true,rpc:vi.fn()}))
vi.mock('@/lib/api/withTenantAuth',()=>({withTenantAuth:(_options:unknown,handler:(request:NextRequest,context:unknown)=>unknown)=>(request:NextRequest)=>handler(request,{organization:{id:'trusted-org',role:'owner'},user:{id:'trusted-actor'}})}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({})}))
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({rpc:state.rpc})}))
vi.mock('@/lib/agenda/booking-settings',()=>({loadAgendaConfigForBooking:async()=>({capabilities:{professionalBooking:true,homeAppointments:state.ready}})}))
import {POST} from '@/app/api/agenda/route'
const input={customer_name:'Ana',service_name:'Visita',price:50000,starts_at:'2026-11-16T10:00:00Z',duration_minutes:30,attention_mode:'home',service_address:'Calle 1',travel_before_minutes:15,travel_after_minutes:20}
const request=(body:unknown)=>new NextRequest('http://fixture.local/api/agenda',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{state.ready=true;state.rpc.mockReset();state.rpc.mockResolvedValue({data:{...input,id:'appointment'},error:null})})
it('uses the atomic home writer and tenant and actor from the session',async()=>{const response=await POST(request({...input,organization_id:'forged',actor_id:'forged'}));expect(response.status).toBe(201);expect(state.rpc).toHaveBeenCalledWith('save_agenda_home_appointment',expect.objectContaining({p_org:'trusted-org',p_actor:'trusted-actor',p_input:expect.objectContaining({service_address:'Calle 1',travel_before_minutes:15})}));expect(state.rpc.mock.calls[0][1].p_input).not.toHaveProperty('organization_id')})
it('does not pretend to save home details before the migration',async()=>{state.ready=false;const response=await POST(request(input));expect(response.status).toBe(503);expect(state.rpc).not.toHaveBeenCalled()})
it('rejects a missing address before accessing a writer',async()=>{const response=await POST(request({...input,service_address:''}));expect(response.status).toBe(400);expect(state.rpc).not.toHaveBeenCalled()})