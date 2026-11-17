import type { SupabaseClient } from '@supabase/supabase-js'
export async function publicRepairStore(db:SupabaseClient,organizationId:string) {
 const {data,error}=await db.from('organizations').select('name, slug').eq('id',organizationId).single()
 if(error||!data)throw new Error('No se pudo consultar el comercio de la reparación')
 return {name:data.name as string,slug:data.slug as string}
}
