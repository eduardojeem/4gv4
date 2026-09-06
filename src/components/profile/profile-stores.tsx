'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  PackageCheck,
  ShoppingBag,
  Store,
  WalletCards,
  Wrench,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { customerRepairsListHref } from '@/lib/public/store-scoped-href'
import type { CustomerStoreSummary } from '@/lib/profile/customer-stores'

interface ProfileStoresProps {
  stores: CustomerStoreSummary[]
}

/** Una cifra de la tienda. Solo se pinta si dice algo. */
function Metric({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: typeof Wrench
  label: string
  value: string
  tone?: 'neutral' | 'warning' | 'good'
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cn(
          'mt-0.5 truncate text-sm font-bold tabular-nums',
          tone === 'warning' && 'text-amber-700 dark:text-amber-300',
          tone === 'good' && 'text-emerald-700 dark:text-emerald-300',
          tone === 'neutral' && 'text-foreground'
        )}
      >
        {value}
      </p>
    </div>
  )
}

/**
 * La cuenta abierta por tienda.
 *
 * El resumen general suma todo junto, y entre varias tiendas eso no es
 * accionable: «por pagar 800.000» no dice a quien, y un equipo listo para
 * retirar no dice donde. Aca cada tienda trae sus propios numeros y el camino
 * para ir a resolverlos.
 *
 * Con una sola tienda no aporta nada —seria repetir el resumen de arriba—, asi
 * que quien lo usa decide cuando mostrarlo.
 */
export function ProfileStores({ stores }: ProfileStoresProps) {
  if (stores.length === 0) return null

  const conPendientes = stores.filter((store) => store.needsAttention).length
  const orderedStores = [...stores].sort((left, right) => {
    const overdueDifference = right.summary.financing.overdueCount - left.summary.financing.overdueCount
    if (overdueDifference !== 0) return overdueDifference
    if (left.needsAttention !== right.needsAttention) return left.needsAttention ? -1 : 1
    return right.summary.totalDue - left.summary.totalDue
  })

  return (
    <section
      id="tiendas"
      aria-labelledby="profile-stores-title"
      className="scroll-mt-20 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="profile-stores-title" className="text-sm font-semibold text-foreground">
            Actividad por tienda
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {conPendientes > 0
            ? `${conPendientes} de ${stores.length} con algo pendiente`
            : `${stores.length} tiendas · todo al día`}
        </p>
      </div>

      <ul className="divide-y divide-border">
        {orderedStores.map((store) => {
          const { organization, summary, needsAttention } = store
          const nombre = organization?.name ?? 'Tienda sin identificar'
          const perfilHref = organization ? `/${organization.slug}/perfil` : null
          const reparacionesHref = organization
            ? customerRepairsListHref(organization.slug, '')
            : null
          const creditsHref = organization
            ? `/${organization.slug}/perfil/creditos`
            : null
          const hasRepairs = summary.equipment.total > 0
          const hasCredits = summary.financing.pendingAmount > 0 || summary.financing.overdueCount > 0

          return (
            <li key={store.organizationId} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {organization?.logo_url ? (
                    // Logo de la tienda: `img` y no `next/image` porque la URL es
                    // de un dominio por organizacion y no todas estan permitidas.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={organization.logo_url}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-lg border border-border/70 object-contain"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Store className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0">
                    {perfilHref ? (
                      <Link
                        href={perfilHref}
                        className="block truncate text-sm font-semibold text-foreground hover:text-primary hover:underline"
                      >
                        {nombre}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-semibold text-muted-foreground">{nombre}</span>
                    )}
                    <p className="mt-0.5 flex items-center gap-1 text-[11px]">
                      {needsAttention ? (
                        <>
                          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                          <span className="text-amber-700 dark:text-amber-300">
                            {summary.equipment.ready > 0 && summary.totalDue > 0
                              ? 'Equipo para retirar y saldo por pagar'
                              : summary.equipment.ready > 0
                                ? summary.equipment.ready === 1
                                  ? 'Tenés un equipo listo para retirar'
                                  : `Tenés ${summary.equipment.ready} equipos listos para retirar`
                                : 'Tenés saldo por pagar'}
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                          <span className="text-muted-foreground">Sin pendientes</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row">
                  {hasCredits && creditsHref && (
                    <Link
                      href={creditsHref}
                      aria-label={`Ver créditos de ${nombre}`}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                    >
                      Créditos
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  )}
                  {hasRepairs && reparacionesHref && (
                    <Link
                      href={reparacionesHref}
                      aria-label={`Ver reparaciones de ${nombre}`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      Reparaciones
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <Metric
                  icon={Wrench}
                  label="Equipos"
                  value={
                    summary.equipment.active > 0
                      ? `${summary.equipment.total} · ${summary.equipment.active} en proceso`
                      : String(summary.equipment.total)
                  }
                />
                <Metric
                  icon={PackageCheck}
                  label="Para retirar"
                  value={String(summary.equipment.ready)}
                  tone={summary.equipment.ready > 0 ? 'warning' : 'neutral'}
                />
                <Metric
                  icon={summary.totalDue > 0 ? CircleDollarSign : ShoppingBag}
                  label="Por pagar"
                  value={summary.totalDue > 0 ? formatCurrency(summary.totalDue) : 'Al día'}
                  tone={summary.totalDue > 0 ? 'warning' : 'good'}
                />
                <Metric
                  icon={WalletCards}
                  label="Saldo a favor"
                  value={summary.storeCredit > 0 ? formatCurrency(summary.storeCredit) : '—'}
                  tone={summary.storeCredit > 0 ? 'good' : 'neutral'}
                />
              </div>

              {summary.financing.overdueCount > 0 && (
                <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {summary.financing.overdueCount === 1
                    ? '1 cuota vencida'
                    : `${summary.financing.overdueCount} cuotas vencidas`}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
