import type { createAdminSupabase } from '@/lib/supabase/admin'
import { WHOLESALE_PRICE_PERMISSION } from './wholesale-access'
import { PRODUCT_READ_COST_PERMISSION, PRODUCT_UPDATE_COST_PERMISSION } from '@/lib/products/cost-access'

const tenantPermissions = new Set([WHOLESALE_PRICE_PERMISSION, PRODUCT_READ_COST_PERMISSION, PRODUCT_UPDATE_COST_PERMISSION])
export function isTenantManagedPermission(permission: string) { return tenantPermissions.has(permission) }
export function isManagedPermissionVisible(row: {permission: string; organization_id?: string | null},organizationId: string | null) {
 return !isTenantManagedPermission(row.permission) || (organizationId!==null && row.organization_id===organizationId)
}
/** Sync only the active tenant's cost/wholesale grants. Other tenants and legacy NULL grants remain untouched. */
export async function syncManagedUserPermissions(client: ReturnType<typeof createAdminSupabase>,userId: string,organizationId: string | null,permissions: string[]) {
 if(!organizationId && permissions.some(isTenantManagedPermission))throw new Error('Seleccioná una organización para asignar permisos de precios o costos.')
 const {data,error}=await client.from('user_permissions').select('permission, organization_id').eq('user_id',userId).eq('is_active',true)
 if(error)throw error
 const current=new Set<string>((data??[]).filter(row=>isManagedPermissionVisible(row,organizationId)).map(row=>row.permission))
 const next=new Set(permissions)
 const added=[...next].filter(permission=>!current.has(permission))
 if(added.length){
  const result=await client.from('user_permissions').insert(added.map(permission=>({user_id:userId,organization_id:isTenantManagedPermission(permission)?organizationId:null,permission,is_active:true})))
  if(result.error)throw result.error
 }
 const removed=[...current].filter(permission=>!next.has(permission))
 const global=removed.filter(permission=>!isTenantManagedPermission(permission))
 if(global.length){
  const result=await client.from('user_permissions').update({is_active:false}).eq('user_id',userId).in('permission',global)
  if(result.error)throw result.error
 }
 const scoped=removed.filter(isTenantManagedPermission)
 if(scoped.length && organizationId){
  const result=await client.from('user_permissions').update({is_active:false}).eq('user_id',userId).eq('organization_id',organizationId).in('permission',scoped)
  if(result.error)throw result.error
 }
}
