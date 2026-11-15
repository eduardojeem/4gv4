import {NextResponse} from 'next/server'
import {withTenantAuth} from '@/lib/api/withTenantAuth'
import {createAdminSupabase} from '@/lib/supabase/admin'
import {getRequestedBranchId,resolveBranchScopeForUser} from '@/lib/branches/server'
import {summarizeCollectionMethods} from '@/lib/credits/collection-method-summary'
import {logger} from '@/lib/logger'
export const GET=withTenantAuth({permission:'pos.sales.create',module:'pos'},async(request,{organization,user})=>{
 try{
  const scope=await resolveBranchScopeForUser({organizationId:organization.id,userId:user.id,role:user.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],requestedBranchId:getRequestedBranchId(request)})
  if(!scope.branchId)return NextResponse.json({error:'Elegí una sucursal.'},{status:409})
  const end=new Date(),start=new Date(end.getTime()-24*60*60*1000),admin=createAdminSupabase()
  const [records,settings]=await Promise.all([
   admin.from('customer_collection_requests').select('request,result').eq('organization_id',organization.id).eq('branch_id',scope.branchId).gte('created_at',start.toISOString()).lte('created_at',end.toISOString()).not('result','is',null).order('created_at').order('id').limit(1001),
   admin.from('organization_settings').select('currency').eq('organization_id',organization.id).maybeSingle()
  ])
  if(records.error)throw records.error
  if(settings.error)throw settings.error
  if(!settings.data?.currency)throw new Error('No se pudo confirmar la moneda.')
  if(records.data.length>1000)return NextResponse.json({error:'El período supera el límite del resumen. Consultá el detalle de créditos; no se muestran totales parciales.'},{status:422})
  return NextResponse.json({organizationId:organization.id,branchId:scope.branchId,currency:settings.data.currency,start:start.toISOString(),end:end.toISOString(),totals:summarizeCollectionMethods(records.data)},{headers:{'Cache-Control':'no-store'}})
 }catch(error){logger.error('[credit-collections-summary]',{error});return NextResponse.json({error:'No se pudieron verificar los cobros de cuotas.'},{status:500})}
})
