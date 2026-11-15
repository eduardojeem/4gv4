import 'server-only'
import {createAdminSupabase} from '@/lib/supabase/admin'
/** Separate opt-in: the retention cron alone must never activate erasure. */
export async function runApprovedOrganizationErasures(){
 const result={enabled:process.env.SUBSCRIPTION_ERASURE_ENABLED==='true',erased:0,filesRemoved:0,blocked:0,failed:0}
 if(!result.enabled)return result
 const admin=createAdminSupabase()
 const {data,error}=await admin.from('organization_nonrenewal_cycles').select('organization_id').is('resolved_at',null).is('erased_at',null).not('erasure_approved_at','is',null).lte('deletion_due_at',new Date().toISOString()).order('deletion_due_at').limit(100)
 if(error)throw new Error('No se pudieron consultar las bajas revisadas')
 for(const row of data??[]){
  const complete=await admin.rpc('complete_nonrenewal_erasure',{p_organization_id:row.organization_id})
  if(complete.error){result.blocked++;continue}
  if(complete.data)result.erased++
 }
 // Only the committed database cutover marks objects ready. Already erased
 // organizations do not occupy the new-erasure batch or block its pagination.
 const files=await admin.from('organization_erasure_files').select('organization_id,bucket_id,object_path,ready_at').eq('disposition','delete').not('ready_at','is',null).is('removed_at',null).order('ready_at').limit(500)
 if(files.error)throw new Error('No se pudo consultar la limpieza de archivos')
 for(const file of files.data??[]){
  if(!file.object_path.split('/').includes(file.organization_id)||file.object_path.includes('..')){result.failed++;continue}
  const removed=await admin.storage.from(file.bucket_id).remove([file.object_path])
  if(removed.error){result.failed++;continue}
  const marked=await admin.from('organization_erasure_files').update({removed_at:new Date().toISOString()}).eq('organization_id',file.organization_id).eq('bucket_id',file.bucket_id).eq('object_path',file.object_path).eq('ready_at',file.ready_at)
  if(marked.error){result.failed++;continue}
  result.filesRemoved++
 }
 return result
}