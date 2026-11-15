import {readNonrenewalCycle} from '@/lib/saas/nonrenewal-retention';
import {NextResponse} from 'next/server';
import {withTenantAuth} from '@/lib/api/withTenantAuth';
import {createAdminSupabase} from '@/lib/supabase/admin';
import {nonrenewalState} from '@/lib/saas/nonrenewal-policy';
export const GET=withTenantAuth({},async(_request,{organization,user})=>{
 const result=await createAdminSupabase().from('subscriptions').select('status,payment_status,current_period_ends_at,trial_ends_at').eq('organization_id',organization.id).maybeSingle();
 if(result.error)return NextResponse.json({error:'No se pudo verificar la suscripción.'},{status:503});
 let cycle:Awaited<ReturnType<typeof readNonrenewalCycle>>=null;
 try{cycle=await readNonrenewalCycle(organization.id,result.data??{});}catch{return NextResponse.json({error:'No se pudo verificar el plazo de renovación.'},{status:503});}
 const access=nonrenewalState(result.data??{status:'suspended'},new Date(),cycle?.notified_at);
 if(access.blocked&&!cycle?.archived_at){access.title='Tu plan venció. Renovalo para volver a operar';}
 return NextResponse.json({...access,organizationId:organization.id,canRenew:['owner','admin'].includes(organization.role)||user.role==='super_admin'}, {headers:{'Cache-Control':'no-store'}});
});
