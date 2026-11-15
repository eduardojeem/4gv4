'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { CalendarCheck2, Clock } from 'lucide-react'
import { ServicePromotionBadge } from '@/components/public/agenda/ServicePromotionNote'
import { formatCurrency } from '@/lib/currency'
import { priceWithServicePromotion, type ServicePromotion } from '@/lib/public/service-promotions'

type AgendaService = { id: string; name: string; duration: number; price: number | null; promotions?: ServicePromotion[] }
type AgendaInfo = { currency: string; services: AgendaService[] }

async function fetchAgenda(url: string): Promise<AgendaInfo | null> {
  const response = await fetch(url)
  // Sin agenda online (404) la sección simplemente no aparece.
  if (!response.ok) return null
  return response.json()
}

/**
 * «Promos en servicios»: las mismas promos que la reserva muestra para cada
 * servicio, con el botón que abre /turnos con ese servicio ya elegido. Así lo
 * que anuncia Ofertas y lo que ve el cliente al reservar es lo mismo.
 */
export function ServicePromotionsSection({ tenantSlug, tenantPrefix }: { tenantSlug: string | null; tenantPrefix: string }) {
  const { data } = useSWR(tenantSlug ? `/api/public/agenda/${encodeURIComponent(tenantSlug)}` : null, fetchAgenda, { revalidateOnFocus: false })
  const services = (data?.services ?? []).filter((service) => service.promotions?.length)
  if (!data || services.length === 0) return null
  const currency = data.currency

  return (
    <section aria-labelledby="promos-servicios" className="border-b border-border/70 py-8 sm:py-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2 id="promos-servicios" className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Promos en servicios</h2>
          <p className="mt-1 text-sm text-muted-foreground">Reservá online y el descuento se aplica al pagar en el local.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const promotion = service.promotions![0]
            const promoPrice = priceWithServicePromotion(service.price, promotion)
            return (
              <li key={service.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
                <div className="space-y-1.5">
                  <ServicePromotionBadge promotion={promotion} currency={currency} />
                  <h3 className="font-semibold text-foreground">{service.name}</h3>
                  <p className="text-sm text-muted-foreground">{promotion.description || promotion.name}</p>
                </div>
                <div className="mt-auto flex flex-wrap items-end justify-between gap-2">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden="true" /> {service.duration} min
                    {service.price != null && service.price > 0 && (
                      promoPrice != null
                        ? <> · <s>{formatCurrency(service.price, { currency })}</s> <strong className="text-sm text-foreground">{formatCurrency(promoPrice, { currency })}</strong></>
                        : <> · {formatCurrency(service.price, { currency })}</>
                    )}
                  </p>
                  <Link
                    href={`${tenantPrefix}/turnos?servicio=${encodeURIComponent(service.id)}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110"
                  >
                    <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Reservar con este descuento
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
