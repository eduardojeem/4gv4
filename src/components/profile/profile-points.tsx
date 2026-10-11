import { Gift, Star } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { CustomerPoints } from '@/lib/loyalty/customer-points'

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })

/**
 * «Mis puntos» en el perfil del cliente de la tienda.
 *
 * El cliente no tenía cómo ver sus puntos: ni acá ni en el comprobante. Un
 * programa de puntos que no se ve no hace volver a nadie.
 */
export function ProfilePoints({ points }: { points: CustomerPoints }) {
  const { balance, redemption, earning, movements } = points
  const plural = balance === 1 ? 'punto' : 'puntos'
  const faltan = redemption?.min && balance < redemption.min ? redemption.min - balance : 0

  return (
    <section aria-labelledby="mis-puntos" className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="mis-puntos" className="flex items-center gap-2 text-base font-bold text-foreground">
            <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
            Mis puntos
          </h2>
          {earning.currencyPerPoint > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sumás {earning.pointsPerUnit === 1 ? '1 punto' : `${earning.pointsPerUnit} puntos`} cada {formatCurrency(earning.currencyPerPoint)} de compra.
            </p>
          )}
        </div>
        <p className="text-right">
          <span className="block text-3xl font-black tabular-nums text-primary">{balance.toLocaleString('es-PY')}</span>
          <span className="text-xs text-muted-foreground">{plural}</span>
        </p>
      </div>

      {redemption && balance > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <Gift className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {faltan > 0
              ? <>Te faltan <strong className="font-semibold">{faltan.toLocaleString('es-PY')} puntos</strong> para poder canjearlos.</>
              : <>Equivalen a <strong className="font-semibold">{formatCurrency(redemption.balanceValue)}</strong> para tu próxima compra. Pedí el canje al pagar.</>}
          </span>
        </p>
      )}

      {movements.length > 0 ? (
        <ul className="mt-4 divide-y divide-border/60">
          {movements.map((movement) => (
            <li key={movement.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate text-foreground">{movement.description}</span>
                <span className="text-xs text-muted-foreground">{fecha(movement.createdAt)}</span>
              </span>
              <span className={movement.points > 0 ? 'shrink-0 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400' : 'shrink-0 font-semibold tabular-nums text-muted-foreground'}>
                {movement.points > 0 ? '+' : ''}{movement.points.toLocaleString('es-PY')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Todavía no sumaste puntos. Se suman solos con cada compra.</p>
      )}
    </section>
  )
}
