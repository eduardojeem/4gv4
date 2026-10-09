import { describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc:vi.fn(), slots:vi.fn(), query:vi.fn() }))
const token = '11111111-1111-4111-8111-111111111111'
vi.mock('@/lib/supabase/admin', () => ({createAdminSupabase: () => ({ rpc:mocks.rpc,from:(table:string)=>{
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='organizations'?{slug:'store'}:{
    id:'appointment',organization_id:'org',customer_name:'Cliente',service_name:'Corte',service_product_id:'service',professional_id:'prof',
    starts_at:'2099-10-10T09:00:00Z',ends_at:'2099-10-10T09:45:00Z',price:40000,buffer_minutes:5,status:'confirmed',sale_id:null,
  },error:null})};return q
}}) }))
vi.mock('@/lib/agenda/public-agenda-server', () => ({resolvePublicAgenda:async()=>({organization:{id:'org'},config:{capabilities:{professionalBooking:true},timeZone:'UTC',settings:{require_confirmation:true}}}),publicSlotsFor:mocks.slots}))
vi.mock('@/lib/rate-limiter', () => ({rateLimiter:{check:async()=>true},getClientIp:()=> 'ip'}))
vi.mock('@/lib/agenda/appointment-events', () => ({notifyAppointmentEvent:vi.fn(),notifyOptionsFor:vi.fn()}))
vi.mock('@/lib/logger', () => ({logger:{error:vi.fn()}}))
import { POST } from '@/app/api/public/appointment/[token]/route'
describe('atomic public rescheduling',()=>{
  it('passes the public token and returns only a safe mutation result',async()=>{
    mocks.rpc.mockResolvedValue({data:{starts_at:'2099-10-11T09:00:00Z',status:'pending',price:40000,customer_phone:'private'},error:null})
    const response=await POST(new Request('http://x/api/public/appointment/'+token,{method:'POST',body:JSON.stringify({action:'reschedule',starts_at:'2099-10-11T09:00:00Z'})}),{params:Promise.resolve({token})})
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('reschedule_agenda_appointment',expect.objectContaining({p_org:'org',p_id:'appointment',p_public_token:token}))
    expect(await response.json()).toEqual({ok:true,startsAt:'2099-10-11T09:00:00Z',status:'pending'})
  })
})
