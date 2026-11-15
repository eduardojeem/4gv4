import Link from 'next/link'
import { ArrowRight, Store } from 'lucide-react'
import { BUSINESS_PROMO_LINKS } from '@/lib/public/marketplace-business-promo'

/**
 * Aviso corto para negocios al pie de la portada. El que entra a comprar no
 * busca planes: antes acá iba la presentación completa con planes y límites
 * (unos 2.300 px en el celular). Los planes siguen en /saas.
 */
export function MarketplaceBusinessBanner() {
  return (
    <section aria-labelledby="marketplace-business-banner-title" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Store className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="marketplace-business-banner-title" className="font-semibold text-foreground">¿Tenés un negocio?</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Publicá tu tienda en el marketplace y manejá ventas, stock y clientes desde la app y la web.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={BUSINESS_PROMO_LINKS.web.plans}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Ver planes
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={BUSINESS_PROMO_LINKS.web.system}
            className="inline-flex min-h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Ver funciones
          </Link>
        </div>
      </div>
    </section>
  )
}
