import { z } from 'zod';
export const agendaSummarySchema = z.object({ available:z.literal(true), timeZone:z.string().refine(value=>{try{new Intl.DateTimeFormat('es-PY',{timeZone:value});return true}catch{return false}}), pendingCount:z.number().int().nonnegative(), appointments:z.array(z.object({id:z.string(),starts_at:z.string().datetime({offset:true}),customer_name:z.string(),service_name:z.string(),status:z.enum(['pending','confirmed','completed','cancelled','no_show'])})) });
export function agendaSummaryCounts(data:z.infer<typeof agendaSummarySchema>) {
 return {registered:data.appointments.filter(item=>item.status!=='cancelled').length,completed:data.appointments.filter(item=>item.status==='completed').length,noShow:data.appointments.filter(item=>item.status==='no_show').length,pending:data.pendingCount,partial:data.appointments.length>=2000};
}

export type AgendaSummaryData = z.infer<typeof agendaSummarySchema>;
