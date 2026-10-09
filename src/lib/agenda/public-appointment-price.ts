import type { SupabaseClient } from '@supabase/supabase-js'
/** Keep booked privacy and fail closed if the current service becomes private. */
export async function publicAppointmentPrice(admin:SupabaseClient,appointment:{id:string;organization_id:string;service_product_id:string|null;price:number}) {
  const quote=await admin.from('agenda_booking_quotes').select('hide_price').eq('appointment_id',appointment.id).eq('organization_id',appointment.organization_id).maybeSingle()
  if (quote.data && quote.data.hide_price!==false) return null
  if (quote.error && !['42P01','PGRST205'].includes(quote.error.code??'')) return null
  if (!appointment.service_product_id) return null
  const product=await admin.from('products').select('hide_price').eq('id',appointment.service_product_id).eq('organization_id',appointment.organization_id).maybeSingle()
  return !product.error && product.data?.hide_price===false ? Number(appointment.price):null
}
