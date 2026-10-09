import { resolveServiceTerms } from './service-terms'
import type { AgendaProfessionalRate, AgendaService } from './agenda-server'
import type { Appointment } from '@/components/dashboard/agenda/types'
export function editorServiceTerms(service: Pick<AgendaService,'product_id'|'price'|'duration_minutes'|'buffer_minutes'>, professionalId: string | null, rates: AgendaProfessionalRate[], original: Pick<Appointment,'service_product_id'|'professional_id'|'price'|'starts_at'|'ends_at'|'buffer_minutes'> | null) {
  if (original?.service_product_id===service.product_id && original.professional_id===professionalId) return {
    price:Number(original.price),durationMinutes:Math.round((Date.parse(original.ends_at)-Date.parse(original.starts_at))/60000),bufferMinutes:original.buffer_minutes??0,
  }
  const rate=rates.find(row=>row.product_id===service.product_id&&row.professional_id===professionalId)
  return resolveServiceTerms({price:service.price,durationMinutes:service.duration_minutes,bufferMinutes:service.buffer_minutes??0},rate?{price:rate.price,durationMinutes:rate.duration_minutes,bufferMinutes:rate.buffer_minutes}:null)
}
