import 'server-only'
import {createAdminSupabase} from '@/lib/supabase/admin'
import {sendEmail} from '@/lib/email/resend'
import {nonrenewalExpiry,nonrenewalState,NONRENEWAL_WARNING,type NonrenewalSubscription} from './nonrenewal-policy'

export const retentionEnabled = () => process.env.SUBSCRIPTION_RETENTION_ENABLED === 'true'
type Cycle={erased_at?:string|null;expired_at:string;notified_at:string;archive_due_at:string;deletion_due_at:string;archived_at:string|null;resolved_at:string|null;archive_warning_sent_at:string|null;deletion_warning_sent_at:string|null}
export async function readNonrenewalCycle(organizationId:string,subscription:NonrenewalSubscription){
 if(!retentionEnabled())return null
 const {data,error}=await createAdminSupabase().from('organization_nonrenewal_cycles').select('*').eq('organization_id',organizationId).maybeSingle()
 if(error)throw new Error('No se pudo consultar el ciclo de renovación')
 const cycle=data as Cycle|null
 return cycle&&!cycle.resolved_at&&Date.parse(cycle.expired_at)===nonrenewalExpiry(subscription)?cycle:null
}

/** Disabled until migration and published terms are ready. Never deletes data. */
export async function runNonrenewalRetention(){
 const result={enabled:retentionEnabled(),notified:0,archived:0,pendingDeletionReview:0,failed:0}
 if(!result.enabled)return result
 const admin=createAdminSupabase()
 const pageSize=200
 for(let offset=0;;offset+=pageSize){
  const {data,error}=await admin.from('subscriptions').select('organization_id,status,payment_status,current_period_ends_at,trial_ends_at').order('organization_id').range(offset,offset+pageSize-1)
  if(error)throw new Error('No se pudieron consultar las suscripciones para retención')
  for(const sub of data??[]){
   try{
    const expiry=nonrenewalExpiry(sub)
    if(!nonrenewalState(sub).blocked||expiry===null||expiry>Date.now())continue
    let cycle=await readNonrenewalCycle(sub.organization_id,sub)
    if(cycle?.erased_at)continue
    // Only the owner's verified Auth email receives the retention notice.
    const owner=await admin.from('organizations').select('owner_id').eq('id',sub.organization_id).single()
    if(owner.error||!owner.data.owner_id){result.failed++;continue}
    const user=await admin.auth.admin.getUserById(owner.data.owner_id)
    const email=user.data.user?.email
    if(user.error||!email||!user.data.user?.email_confirmed_at){result.failed++;continue}
    const now=Date.now()
    const kind=!cycle?'initial':!cycle.archive_warning_sent_at&&now>=Date.parse(cycle.archive_due_at)-7*86400000?'archive':!cycle.deletion_warning_sent_at&&now>=Date.parse(cycle.deletion_due_at)-7*86400000?'deletion':null
    if(kind){
     const date=cycle?(kind==='archive'?cycle.archive_due_at:cycle.deletion_due_at):null
     const detail=date?' Fecha prevista: '+new Intl.DateTimeFormat('es-PY',{timeZone:'America/Asuncion',dateStyle:'long'}).format(new Date(date))+'.':''
     const sent=await sendEmail({to:email,subject:kind==='initial'?'Tu plan venció: renovación y conservación de datos':kind==='archive'?'Tu empresa se archivará: todavía podés renovarla':'Aviso previo a la baja de tu empresa',html:'<p>'+NONRENEWAL_WARNING+'</p><p>'+detail+'</p><p>Ingresá a MiTiendaPy → Administración → Suscripción para renovar. Podés solicitar una copia de tus datos a soporte antes de la baja.</p>'})
     // A skipped provider call is not a notification and cannot start the clock.
     if(!sent.ok||sent.skipped||!sent.id){result.failed++;continue}
     if(kind==='initial'){
      const saved=await admin.rpc('register_nonrenewal_notice',{p_organization_id:sub.organization_id,p_expired_at:new Date(expiry).toISOString(),p_provider_message_id:sent.id})
      if(saved.error)throw saved.error
      cycle=await readNonrenewalCycle(sub.organization_id,sub)
     }else{
      const saved=await admin.from('organization_nonrenewal_cycles').update({[kind==='archive'?'archive_warning_sent_at':'deletion_warning_sent_at']:new Date().toISOString()}).eq('organization_id',sub.organization_id).eq('expired_at',cycle!.expired_at).is('resolved_at',null)
      if(saved.error)throw saved.error
     }
     result.notified++
    }
    if(cycle){
     const advanced=await admin.rpc('advance_nonrenewal_cycle',{p_organization_id:sub.organization_id})
     if(advanced.error)throw advanced.error
     if(advanced.data==='archived')result.archived++
     if(advanced.data==='pending_deletion_review')result.pendingDeletionReview++
    }
   }catch{result.failed++}
  }
  if((data?.length??0)<pageSize)break
 }
 return result
}