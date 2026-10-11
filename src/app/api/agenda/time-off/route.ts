import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { loadAgendaConfig } from '@/lib/agenda/agenda-server'
import { bookingWriteError } from '@/lib/agenda/booking-writes'
import { publicMessageProblem } from '@/lib/agenda/closures'
const guard={permission:'settings.manage',module:'services'} as const
const interval=z.object({professional_id:z.string().uuid().nullable(),starts_at:z.string().datetime({offset:true}),ends_at:z.string().datetime({offset:true}),reason:z.string().trim().max(300).nullable().optional(),public_message:z.string().trim().max(160).nullable().optional()})
  .refine(row=>Date.parse(row.ends_at)>Date.parse(row.starts_at) && Date.parse(row.ends_at)-Date.parse(row.starts_at)<=180*86400000,'El fin debe ser posterior al inicio (máximo 180 días).')
async function ready(org:string){return (await loadAgendaConfig(await createClient(),org))?.capabilities.professionalBooking===true}
const unavailable=()=>NextResponse.json({error:'Falta aplicar la migración transaccional de reservas.'},{status:503})
// El aviso público es una columna aparte: sin su migración, las ausencias siguen andando sin él.
const missingPublicMessage=(error:{message?:string}|null)=>Boolean(error && /public_message/.test(error.message??''))
export const GET=withTenantAuth(guard,async(request,{organization})=>{
  if(!await ready(organization.id))return unavailable()
  const admin=createAdminSupabase()
  const params=new URL(request.url).searchParams
  if(params.has('starts_at') || params.has('ends_at')){
    const parsed=interval.safeParse({professional_id:params.get('professional_id'),starts_at:params.get('starts_at'),ends_at:params.get('ends_at')})
    if(!parsed.success)return NextResponse.json({error:'Revisá el período de la ausencia.'},{status:400})
    const row=parsed.data
    let query=admin.from('appointments').select('id, customer_name, service_name, starts_at, ends_at',{count:'exact'})
      .eq('organization_id',organization.id).in('status',['pending','confirmed']).lt('starts_at',row.ends_at).gt('occupied_until',row.starts_at)
    if(row.professional_id)query=query.or(`professional_id.is.null,professional_id.eq.${row.professional_id}`)
    const {data,error,count}=await query.order('starts_at').limit(100)
    if(error)return NextResponse.json({error:'No se pudieron comprobar los turnos afectados.'},{status:500})
    return NextResponse.json({conflicts:data??[],total:count??0},{headers:{'Cache-Control':'no-store'}})
  }
  const list=(columns:string)=>admin.from('agenda_time_off').select(columns).eq('organization_id',organization.id)
    .gt('ends_at',new Date().toISOString()).order('starts_at').limit(1000)
  let publicMessageAvailable=true
  let {data,error}=await list('id,professional_id,starts_at,ends_at,reason,public_message')
  if(missingPublicMessage(error)){publicMessageAvailable=false;({data,error}=await list('id,professional_id,starts_at,ends_at,reason'))}
  if(error)return NextResponse.json({error:'No se pudieron cargar las ausencias.'},{status:500})
  return NextResponse.json({blocks:data??[],publicMessageAvailable},{headers:{'Cache-Control':'no-store'}})
})
export const POST=withTenantAuth(guard,async(request,{organization,user})=>{
  const parsed=interval.safeParse(await request.json().catch(()=>null))
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??'Revisá la ausencia.'},{status:400})
  if(!await ready(organization.id))return unavailable()
  const row=parsed.data
  const problem=publicMessageProblem(row.public_message,row.professional_id)
  if(problem)return NextResponse.json({error:problem},{status:400})
  const admin=createAdminSupabase()
  const {data,error}=await admin.rpc('save_agenda_time_off',{p_org:organization.id,p_prof:row.professional_id,p_start:row.starts_at,p_end:row.ends_at,p_reason:row.reason||null,p_actor:user.id})
  if(error){const failure=bookingWriteError(error);return NextResponse.json({error:failure.error,code:failure.code},{status:failure.status})}
  const block=data as {id?:string}|null
  // El aviso se guarda aparte del bloqueo: si falla, la ausencia ya protege la agenda.
  let publicMessageSaved=true
  if(row.public_message?.trim() && block?.id){
    const {error:noticeError}=await admin.from('agenda_time_off').update({public_message:row.public_message.trim()}).eq('organization_id',organization.id).eq('id',block.id)
    publicMessageSaved=!noticeError
  }
  return NextResponse.json({block:data,publicMessageSaved},{status:201})
})
/** Cambiar o quitar el aviso público de una ausencia ya guardada. */
export const PATCH=withTenantAuth(guard,async(request,{organization})=>{
  const parsed=z.object({id:z.string().uuid(),public_message:z.string().trim().max(160).nullable()}).safeParse(await request.json().catch(()=>null))
  if(!parsed.success)return NextResponse.json({error:'Revisá el aviso.'},{status:400})
  if(!await ready(organization.id))return unavailable()
  const admin=createAdminSupabase()
  const {data:current}=await admin.from('agenda_time_off').select('id,professional_id').eq('organization_id',organization.id).eq('id',parsed.data.id).maybeSingle()
  if(!current)return NextResponse.json({error:'No se encontró la ausencia.'},{status:404})
  const message=parsed.data.public_message?.trim()||null
  const problem=publicMessageProblem(message,(current as {professional_id:string|null}).professional_id)
  if(problem)return NextResponse.json({error:problem},{status:400})
  const {error}=await admin.from('agenda_time_off').update({public_message:message}).eq('organization_id',organization.id).eq('id',parsed.data.id)
  if(missingPublicMessage(error))return NextResponse.json({error:'Falta aplicar la migración del aviso público de ausencias.'},{status:503})
  if(error)return NextResponse.json({error:'No se pudo guardar el aviso.'},{status:500})
  return NextResponse.json({ok:true})
})
export const DELETE=withTenantAuth(guard,async(request,{organization})=>{
  const parsed=z.object({id:z.string().uuid()}).safeParse(await request.json().catch(()=>null))
  if(!parsed.success)return NextResponse.json({error:'Ausencia inválida.'},{status:400})
  if(!await ready(organization.id))return unavailable()
  const {data,error}=await createAdminSupabase().from('agenda_time_off').delete().eq('organization_id',organization.id).eq('id',parsed.data.id).select('id').maybeSingle()
  if(error || !data)return NextResponse.json({error:'No se pudo eliminar la ausencia.'},{status:error?500:404})
  return NextResponse.json({ok:true})
})
