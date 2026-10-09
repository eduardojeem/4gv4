'use client'
import { formatCurrency } from '@/lib/currency'
import type { PublicBookingQuote } from './use-booking-quote'
export function BookingQuoteSummary({quote,currency,accepted,onAccept,expired}:{quote:PublicBookingQuote;currency:string;accepted:boolean;onAccept:(value:boolean)=>void;expired:boolean}) {
  return <div className="space-y-2 rounded-lg border bg-muted/30 p-3" aria-label="Resumen del turno">
    <p className="font-medium">{quote.professionalName || 'Atención de la tienda'} · {quote.duration} min</p>
    <p className="text-sm">{quote.price===null?'Precio a consultar':quote.price===0?'Sin costo':formatCurrency(quote.price,{currency})}</p>
    {expired ? <p role="alert" className="text-sm text-destructive">La cotización venció. Actualizá el horario antes de reservar.</p>
      : <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" checked={accepted} onChange={event=>onAccept(event.target.checked)} className="size-5" />
        Acepto el profesional, la duración y el precio indicado.
      </label>}
  </div>
}
