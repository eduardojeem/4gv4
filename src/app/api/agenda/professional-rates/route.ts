import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { loadAgendaConfig } from '@/lib/agenda/agenda-server'
import { professionalRatesSchema } from '@/lib/agenda/booking-config'
import { bookingWriteError } from '@/lib/agenda/booking-writes'
export const PUT=withTenantAuth({permission:'settings.manage',module:'services'},async(request,{organization,user})=>{
  const parsed=professionalRatesSchema.safeParse(await request.json().catch(()=>null))
  if(!parsed.success) return NextResponse.json({error:'Revisá las tarifas, duraciones y márgenes.'},{status:400})
  if(!(await loadAgendaConfig(await createClient(),organization.id))?.capabilities.professionalBooking) return NextResponse.json({error:'Falta aplicar la migración transaccional de reservas.'},{status:503})
  const {error}=await createAdminSupabase().rpc('replace_agenda_professional_rates',{p_org:organization.id,p_prof:parsed.data.professional_id,p_rates:parsed.data.rates,p_actor:user.id})
  if(error){const failure=bookingWriteError(error);return NextResponse.json({error:failure.error,code:failure.code},{status:failure.status})}
  return NextResponse.json({ok:true})
})
