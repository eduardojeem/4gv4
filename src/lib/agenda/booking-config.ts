import { z } from 'zod'
export function parseInheritedNumber(value:string):number|null {
  if(!value.trim()) return null
  const number=Number(value)
  if(!Number.isFinite(number) || number<0) throw new Error('INVALID_NUMBER')
  return number
}
const time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/)
export const openingHoursSchema=z.record(z.string().regex(/^[0-6]$/),z.array(z.tuple([time,time]).refine(([from,to])=>from<to && from!=='24:00','El inicio debe ser anterior al fin.')).max(4))
export const professionalRatesSchema=z.object({professional_id:z.string().uuid(),rates:z.array(z.object({
  product_id:z.string().uuid(),price:z.number().finite().min(0).max(999999999999.99).nullable(),
  duration_minutes:z.number().int().min(5).max(600).nullable(),buffer_minutes:z.number().int().min(0).max(120).nullable(),
})).max(500)}).refine(body=>new Set(body.rates.map(rate=>rate.product_id)).size===body.rates.length,'No repitas el mismo servicio.')
