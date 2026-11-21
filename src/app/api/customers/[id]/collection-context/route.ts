import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { logger } from '@/lib/logger'
/** Read-only preflight. The collection RPC repeats the check under its transaction. */
export const GET = withTenantAuth({permission:'crm.customers.manage',module:['crm','credits']}, async(request,{organization,user},context)=>{
 try {
  const {id} = await (context as {params:Promise<{id:string}>}).params
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:'Cliente inválido.'},{status:400})
  const admin=createAdminSupabase()
  const customer=await admin.from('customers').select('id').eq('id',id).eq('organization_id',organization.id).maybeSingle()
  if(customer.error)throw customer.error
  if(!customer.data)return NextResponse.json({error:'El cliente no pertenece a la organización activa.'},{status:404})
  const scope=await resolveBranchScopeForUser({organizationId:organization.id,userId:user.id,role:user.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],requestedBranchId:getRequestedBranchId(request)})
  if(!scope.branchId)return NextResponse.json({error:'Elegí una sucursal antes de cobrar.'},{status:409})
  const cash=await admin.from('cash_closures').select('id').eq('organization_id',organization.id).eq('branch_id',scope.branchId).is('date',null).limit(1)
  if(cash.error)throw cash.error
  return NextResponse.json({branchId:scope.branchId,cashOpen:cash.data.length>0},{headers:{'Cache-Control':'no-store'}})
 } catch(error){logger.error('[collection-context]',{error});return NextResponse.json({error:'No se pudo comprobar la caja. Reintentá antes de cobrar.'},{status:500})}
})
