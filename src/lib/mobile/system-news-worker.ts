import { createAdminSupabase } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/superadmin/fetch-all-rows'
import { eligibleNewsRecipients, type NewsPreference } from '@/lib/mobile/system-news'
import { dispatchNotificationEvent } from '@/lib/notifications/server/dispatcher'

/** Se llama solo desde el worker autenticado, nunca desde consultas de la app. */
export async function dispatchPublishedSystemNews() {
  const admin=createAdminSupabase()
  const preferences=await fetchAllRows<NewsPreference>((from,to)=>admin.from('notification_preferences').select('organization_id,user_id,push_enabled,updated_at').eq('notification_type','SYSTEM_NEWS').eq('push_enabled',true).order('organization_id').order('user_id').range(from,to))
  if(!preferences.length)return
  const since=new Date(Date.now()-7*86400000).toISOString()
  const announcements=await fetchAllRows<{id:string;target:string;target_org_ids:string[]|null;sent_at:string|null}>((from,to)=>admin.from('global_notifications').select('id,target,target_org_ids,sent_at').eq('status','sent').gte('sent_at',since).order('id').range(from,to))
  for(const announcement of announcements){
    for(const recipients of eligibleNewsRecipients(announcement,preferences)){
      await dispatchNotificationEvent({organizationId:recipients.organizationId,type:'SYSTEM_NEWS',targetUserIds:recipients.userIds,resourceType:'global_announcement',resourceId:announcement.id,idempotencyKey:`platform-news:${announcement.id}:${recipients.organizationId}`})
    }
  }
}
