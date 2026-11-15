import { Tag } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { priceWithServicePromotion, servicePromotionLabel, type ServicePromotion } from '@/lib/public/service-promotions'

/** «20% OFF · COMBO20»: la mejor promo del servicio, en la tarjeta para elegirlo. */
export function ServicePromotionBadge({ promotion, currency, className }: { promotion: ServicePromotion; currency: string; className?: string }) {
  const label = servicePromotionLabel(promotion, (value) => formatCurrency(value, { currency }))
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300', className)}>
      <Tag className="h-3 w-3" aria-hidden="true" />
      {label}
      {promotion.code && <span className="font-mono tracking-wide">· {promotion.code}</span>}
    </span>
  )
}

/**
 * Lo que el cliente tiene que saber antes de confirmar: el descuento existe,
 * pero la reserva no cobra; se aplica al pagar en el local.
 */
export function ServicePromotionNote({ promotion, price, currency }: { promotion: ServicePromotion; price: number | null; currency: string }) {
  const label = servicePromotionLabel(promotion, (value) => formatCurrency(value, { currency }))
  const promoPrice = priceWithServicePromotion(price, promotion)
  return (
    <div role="note" aria-label="Promoción de este servicio" className="rounded-xl border border-emerald-600/30 bg-emerald-600/5 p-3 text-sm dark:border-emerald-400/30">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-emerald-800 dark:text-emerald-200">
        <Tag className="h-4 w-4" aria-hidden="true" />
        {promotion.name} · {label}
        {promoPrice != null && price != null && (
          <span className="font-normal text-muted-foreground">
            <s>{formatCurrency(price, { currency })}</s> → {formatCurrency(promoPrice, { currency })}
          </span>
        )}
      </p>
      {promotion.description && <p className="mt-1 text-muted-foreground">{promotion.description}</p>}
      <p className="mt-1 text-muted-foreground">
        {promotion.code
          ? <>Mencioná el código <strong className="font-mono text-foreground">{promotion.code}</strong> al pagar: el descuento se aplica en el local.</>
          : 'El descuento se aplica al pagar en el local.'}
        {promotion.minPurchase != null && <> Válido desde {formatCurrency(promotion.minPurchase, { currency })}.</>}
      </p>
    </div>
  )
}
