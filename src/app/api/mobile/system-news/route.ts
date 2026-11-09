import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'

const audience = (organizationId:string)=>`target.eq.all,target_org_ids.cs.{${organizationId}}`
export const GET = withTenantAuth({},async(request,{user,organization})=>{
  try {
    const admin=createAdminSupabase()
    const cursor=request.nextUrl.searchParams.get('cursor')
    let query=admin.from('global_notifications').select('id,title,body,type,sent_at').eq('status','sent').or(audience(organization.id)).order('sent_at',{ascending:false}).order('id',{ascending:false}).limit(21)
    if(cursor){
      const [date,id]=cursor.split('|')
      if(!z.string().uuid().safeParse(id).success || !Number.isFinite(Date.parse(date)))return NextResponse.json({error:'Cursor inválido.'},{status:400})
      query=query.or(`sent_at.lt.${new Date(date).toISOString()},and(sent_at.eq.${new Date(date).toISOString()},id.lt.${id})`)
    }
    const {data,error}=await query
    if(error)throw error
    const more=(data?.length??0)>20
    const items=(data??[]).slice(0,20)
    const readIds=new Set<string>()
    if(items.length){const reads=await admin.from('global_notification_reads').select('notification_id').eq('user_id',user.id).in('notification_id',items.map(i=>i.id));if(reads.error)throw reads.error;for(const read of reads.data??[])readIds.add(read.notification_id)}
    const last=items[items.length-1]
    return NextResponse.json({items:items.map(i=>({...i,read:readIds.has(i.id)})),nextCursor:more&&last?`${last.sent_at}|${last.id}`:null},{headers:{'Cache-Control':'private, no-store'}})
  }catch{return NextResponse.json({error:'No se pudieron cargar las novedades.'},{status:500})}
})
export const POST = withTenantAuth({},async(request,{user,organization})=>{
  const body=await request.json().catch(()=>null)
  const parsed=z.object({id:z.string().uuid()}).safeParse(body)
  if(!parsed.success)return NextResponse.json({error:'Aviso inválido.'},{status:400})
  const admin=createAdminSupabase()
  const {data,error}=await admin.from('global_notifications').select('id').eq('id',parsed.data.id).eq('status','sent').or(audience(organization.id)).maybeSingle()
  if(error)return NextResponse.json({error:'No se pudo validar el aviso.'},{status:500})
  if(!data)return NextResponse.json({error:'Aviso no disponible.'},{status:404})
  const read=await admin.from('global_notification_reads').upsert({notification_id:data.id,user_id:user.id,read_at:new Date().toISOString(),dismissed:false},{onConflict:'notification_id,user_id'})
  if(read.error)return NextResponse.json({error:'No se pudo guardar la lectura.'},{status:500})
  return NextResponse.json({success:true})
})
