import { AlertTriangle, CreditCard, Eye, MessageCircle, Store, Truck } from 'lucide-react'
import type { CheckoutSettings } from '@/types/website-settings'

const PAYMENT_LABELS = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  digital_wallet: 'Billetera digital',
} as const

function formatGuarani(value: number): string {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(value)
}

export function CheckoutCustomerPreview({ settings }: { settings: CheckoutSettings }) {
  const commerceMode = settings.commerceMode ?? 'cart'
  const enabledPayments = (Object.keys(PAYMENT_LABELS) as Array<keyof typeof PAYMENT_LABELS>)
    .filter((key) => settings.payment[key].enabled)
  const deliveryZones = settings.delivery.zoneOptions ?? []

  if (commerceMode !== 'cart') {
    const isWhatsApp = commerceMode === 'whatsapp'
    const Icon = isWhatsApp ? MessageCircle : Eye

    return (
      <aside className="lg:sticky lg:top-6" aria-label="Vista previa de la tienda pública">
        <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
          <div className="border-b bg-muted/30 px-4 py-3">
            <p className="text-sm font-semibold">Vista del cliente</p>
            <p className="text-xs text-muted-foreground">Comportamiento de los productos</p>
          </div>
          <div className="p-4">
            <div className="rounded-lg border p-4">
              <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-semibold">
                {isWhatsApp ? 'Consultar por WhatsApp' : 'Solo ver productos'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {isWhatsApp
                  ? 'El botón del carrito se reemplaza por una consulta directa sobre el producto.'
                  : 'El cliente puede ver precios y detalles, pero no puede agregar productos ni crear pedidos.'}
              </p>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              El carrito no aparecerá en el encabezado.
            </p>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="lg:sticky lg:top-6" aria-label="Vista previa del checkout">
      <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
        <div className="border-b bg-muted/30 px-4 py-3">
          <p className="text-sm font-semibold">Vista del cliente</p>
          <p className="text-xs text-muted-foreground">Opciones visibles en el carrito</p>
        </div>

        <div className="space-y-5 p-4">
          <section aria-labelledby="preview-delivery-title">
            <h3 id="preview-delivery-title" className="text-xs font-semibold uppercase text-muted-foreground">
              Entrega
            </h3>
            <div className="mt-2 space-y-2">
              {settings.pickup.enabled && (
                <div className="flex items-start gap-3 rounded-md border p-3">
                  <Store aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Retiro en local</p>
                    <p className="text-xs text-muted-foreground">
                      {settings.pickup.estimatedTime || 'Tiempo a coordinar'}
                    </p>
                  </div>
                </div>
              )}
              {settings.delivery.enabled && (
                <div className="flex items-start gap-3 rounded-md border p-3">
                  <Truck aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Delivery</p>
                    <p className="text-xs text-muted-foreground">
                      {settings.delivery.estimatedTime || 'Tiempo a coordinar'}
                      {' · '}
                      {deliveryZones.length > 0
                        ? `${deliveryZones.length} ${deliveryZones.length === 1 ? 'zona' : 'zonas'}`
                        : settings.delivery.defaultCost > 0
                        ? formatGuarani(settings.delivery.defaultCost)
                        : 'Costo a coordinar'}
                    </p>
                    {deliveryZones.length > 0 && (
                      <div className="mt-2 space-y-1 border-t pt-2">
                        {deliveryZones.slice(0, 4).map((zone) => (
                          <div key={zone.id} className="flex items-center justify-between gap-3 text-[11px]">
                            <span className="truncate text-muted-foreground">{zone.name || 'Zona sin nombre'}</span>
                            <strong className={zone.cost === 0 ? 'text-emerald-700 dark:text-emerald-400' : undefined}>
                              {zone.cost === 0 ? 'Gratis' : formatGuarani(zone.cost)}
                            </strong>
                          </div>
                        ))}
                        {deliveryZones.length > 4 && (
                          <p className="text-[11px] text-muted-foreground">
                            +{deliveryZones.length - 4} zonas más
                          </p>
                        )}
                      </div>
                    )}
                    {settings.delivery.freeThreshold > 0 && (
                      <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        Gratis desde {formatGuarani(settings.delivery.freeThreshold)}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {!settings.pickup.enabled && !settings.delivery.enabled && (
                <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <p className="text-xs">Falta habilitar delivery o retiro.</p>
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="preview-payment-title">
            <h3 id="preview-payment-title" className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <CreditCard aria-hidden="true" className="h-3.5 w-3.5" />
              Pago
            </h3>
            {enabledPayments.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {enabledPayments.map((key) => (
                  <span key={key} className="rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs font-medium">
                    {settings.payment[key].label?.trim() || PAYMENT_LABELS[key]}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
                <p className="text-xs">Falta habilitar un método de pago.</p>
              </div>
            )}
          </section>

          {settings.minOrderAmount > 0 && (
            <div className="border-t pt-3 text-xs">
              <span className="text-muted-foreground">Pedido mínimo: </span>
              <strong>{formatGuarani(settings.minOrderAmount)}</strong>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
