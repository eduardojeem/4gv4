'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  Boxes,
  CircleAlert,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  MoreHorizontal,
  Receipt,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { SuperAdminSubscription } from './types'
import { PlanBadge, StatusBadge } from './subscription-badges'
import {
  daysUntil,
  daysLabel,
  formatDate,
  formatMoney,
  getAttentionLevel,
  getRecommendation,
  periodProgress,
  type AttentionLevel,
} from './utils'

type Props = {
  items: SuperAdminSubscription[]
  onOpenDetail: (subscription: SuperAdminSubscription) => void
  onCopyValue: (value: string | null) => void
}

/**
 * Franja lateral en vez de fondo de color.
 *
 * La tabla pintaba tres fondos a la vez —cebra por fila par/impar, ambar por
 * «requiere atención» y violeta al pasar el mouse—, y competian: una fila con
 * problema en posicion par se veia casi igual que una normal. La franja no
 * compite con nada y deja el fondo libre para el hover.
 */
const ATTENTION_STRIPE: Record<AttentionLevel, string> = {
  urgent: 'before:bg-rose-500',
  watch: 'before:bg-amber-400',
  none: 'before:bg-transparent',
}

// Medido: con `py-3`, tres lineas en «Ciclo» y el avatar de 36px, cada fila
// ocupaba 92px. En una pantalla normal entraban seis suscripciones.
// `whitespace-normal` anula el `whitespace-nowrap` que traen de fabrica
// `TableCell` y `TableHead`. Eso era lo que sostenia el piso de 959px: con
// nowrap, el minimo de cada columna es el ancho COMPLETO de su contenido, asi
// que ni recortar el nombre ni dejar envolver el diagnostico servian de nada.
const CELL = 'py-2 align-top whitespace-normal'

/**
 * «Uso» y «Responsable» son detalle: estan en la ficha de cada suscripcion.
 * Ocupaban 254px de los 1428 que la tabla necesitaba, y por eso habia que
 * arrastrar de costado en cualquier pantalla que no fuera enorme.
 */
const SECONDARY = 'hidden 2xl:table-cell'

export function SubscriptionTable({ items, onOpenDetail, onCopyValue }: Props) {
  return (
    // El alto era `calc(100vh-320px)`: un numero magico que quedaba mal en
    // cuanto cambiaba cualquier cosa arriba. `min-h-0` deja que el contenedor
    // padre reparta el espacio.
    <div className="min-h-0 overflow-auto">
      {/* Ancho automatico, no `table-fixed` con porcentajes: con dos columnas
          ocultas por `media query`, el reparto fijo les seguia reservando su
          parte y «Qué hacer» quedaba en 52px para un texto de 119. Cada columna
          se dimensiona por su contenido y una sola —la que dice que hacer—
          absorbe el sobrante con `w-full`. */}
      <Table className="w-full">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/95">
            {/* Sin porcentajes: un ancho declarado convierte el minimo de la
                celda mas ancha en un minimo de TODA la tabla —223px al 26% son
                858px de piso—. Con ancho automatico el piso es la suma de los
                minimos reales, que es la mitad. Solo «Qué hacer» absorbe el
                sobrante. */}
            <Th className="pl-5">Organización</Th>
            <Th>Plan</Th>
            <Th>Estado</Th>
            <Th>Ciclo</Th>
            <Th className={SECONDARY}>Uso</Th>
            {/* Decia «Owner» en una interfaz en castellano. */}
            <Th className={SECONDARY}>Responsable</Th>
            {/* Absorbe el sobrante: es la que dice QUE HACER y era la unica que
                venia truncada, con el texto completo escondido en un `title`
                que en tactil no existe. */}
            <Th className="w-full">Qué hacer</Th>
            <Th className="pr-3 text-right">Acción</Th>
          </TableRow>
        </TableHeader>

        <TableBody>
          {items.map((sub) => {
            const renewalDays = daysUntil(sub.current_period_ends_at)
            const trialDays = daysUntil(sub.trial_ends_at)
            const level = getAttentionLevel(sub)
            const progress = periodProgress(sub)
            const recommendation = getRecommendation(sub)
            const hasPeriod = Boolean(sub.current_period_starts_at && sub.current_period_ends_at)

            const initials = (sub.organization_name || 'OR')
              .trim()
              .split(/\s+/)
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)

            // Tres situaciones daban todas «Sin costo»: plan gratuito, plan sin
            // fila comercial, y plan que no existe en la tabla tecnica. Solo la
            // primera es un dato; las otras dos son configuracion faltante.
            const price = sub.plan_details?.price_monthly ?? null
            const priceLabel = !sub.plan_details
              ? { text: 'Plan sin configurar', muted: true, warn: true }
              : price === null
                ? { text: 'Precio sin definir', muted: true, warn: true }
                : price === 0
                  ? { text: 'Gratuito', muted: true, warn: false }
                  : { text: formatMoney(price, sub.plan_details.currency || 'PYG'), muted: false, warn: false }

            return (
              <TableRow
                key={sub.id}
                className={cn(
                  'group relative cursor-pointer border-b border-slate-100 transition-colors dark:border-slate-800/60',
                  'hover:bg-violet-50/60 dark:hover:bg-violet-950/20',
                  // La franja de severidad, sin tocar el fondo.
                  'before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[""]',
                  ATTENTION_STRIPE[level]
                )}
                aria-label={`Ver suscripción de ${sub.organization_name}`}
                onClick={() => onOpenDetail(sub)}
              >
                {/* Organización */}
                <TableCell className={cn(CELL, 'pl-5')}>
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white',
                        level === 'urgent'
                          ? 'bg-rose-600'
                          : level === 'watch'
                            ? 'bg-amber-500'
                            : 'bg-violet-600'
                      )}
                    >
                      {initials}
                    </div>

                    <div className="min-w-0 max-w-[200px] flex-1 2xl:max-w-[280px]">
                      {/* El nombre es el control: la fila entera sigue siendo
                          clicable, pero antes cada fila era una parada de
                          tabulador y con 50 suscripciones eran 50 paradas antes
                          de llegar a lo siguiente. */}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenDetail(sub)
                        }}
                        className="block w-full min-w-0 truncate text-left text-sm font-bold text-slate-900 transition-colors hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-slate-100 dark:hover:text-violet-300"
                      >
                        {sub.organization_name}
                      </button>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="hidden truncate font-mono text-[11px] text-slate-400 dark:text-slate-500 2xl:inline">
                          {sub.organization_slug ? `/${sub.organization_slug}` : `${sub.organization_id.slice(0, 8)}…`}
                        </span>
                        <span
                          title={sub.storefront_public ? 'Tienda pública' : 'Tienda privada'}
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                            sub.storefront_public
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          )}
                        >
                          <Globe className="h-2.5 w-2.5 shrink-0" />
                          {/* La palabra solo cuando sobra ancho: es lo que mas
                              engorda el minimo de la columna mas ancha. */}
                          <span className="hidden 2xl:inline">
                            {sub.storefront_public ? 'Pública' : 'Privada'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Plan */}
                <TableCell className={CELL}>
                  <PlanBadge plan={sub.plan} />
                  <p
                    className={cn(
                      'mt-1 text-[11px] tabular-nums',
                      priceLabel.warn
                        ? 'font-semibold text-amber-600 dark:text-amber-400'
                        : priceLabel.muted
                          ? 'font-normal text-slate-400'
                          : 'font-bold text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {priceLabel.text}
                    {!priceLabel.muted && <span className="font-normal text-slate-400">/mes</span>}
                  </p>
                </TableCell>

                {/* Estado */}
                <TableCell className={CELL}>
                  <StatusBadge status={sub.status} />
                  <p className="mt-1 text-[10px]">
                    {sub.cancel_at_period_end ? (
                      <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                        <XCircle className="h-3 w-3 shrink-0" />
                        Cancela al ciclo
                      </span>
                    ) : sub.status === 'trialing' && trialDays !== null ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-cyan-700 dark:text-cyan-300">
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        {daysLabel(trialDays, 'trial')}
                      </span>
                    ) : (
                      <span className="capitalize text-slate-400">Vía {sub.provider || 'manual'}</span>
                    )}
                  </p>
                </TableCell>

                {/* Ciclo */}
                <TableCell className={CELL}>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {sub.current_period_ends_at ? formatDate(sub.current_period_ends_at) : 'Sin cierre'}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-bold tabular-nums',
                        renewalDays !== null && renewalDays < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : renewalDays !== null && renewalDays <= 7
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-500 dark:text-slate-400'
                      )}
                    >
                      {renewalDays === null
                        ? 'Perpetuo'
                        : renewalDays < 0
                          ? `${Math.abs(renewalDays)}d vencido`
                          : renewalDays === 0
                            ? 'Vence hoy'
                            : `${renewalDays}d`}
                    </span>
                  </div>

                  {/* Sin fechas, `periodProgress` devuelve 0 — y una barra en 0
                      se lee como «recien empieza», que es lo contrario de «no se
                      sabe». Sin periodo no se dibuja barra. */}
                  {hasPeriod ? (
                    <>
                      <div
                        title={`Desde ${formatDate(sub.current_period_starts_at)}`}
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Avance del ciclo"
                        className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                      >
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            renewalDays !== null && renewalDays < 0
                              ? 'bg-rose-500'
                              : renewalDays !== null && renewalDays <= 7
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                      Sin ciclo definido
                    </p>
                  )}
                </TableCell>

                {/* Uso */}
                <TableCell className={cn(CELL, SECONDARY)}>
                  <div className="flex flex-wrap gap-1">
                    <UsageChip icon={Users} label="usuarios" value={sub.members_count} />
                    <UsageChip icon={Boxes} label="productos" value={sub.products_count} />
                    <UsageChip icon={Receipt} label="ventas" value={sub.sales_count} />
                  </div>
                </TableCell>

                {/* Responsable */}
                <TableCell className={cn(CELL, SECONDARY)}>
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {sub.owner_name || 'Sin responsable'}
                  </p>
                  <p className="truncate text-[11px] text-slate-400 dark:text-slate-500" title={sub.owner_email || undefined}>
                    {sub.owner_email || sub.owner_id || 'Sin correo'}
                  </p>
                </TableCell>

                {/* Qué hacer */}
                <TableCell className={CELL}>
                  <div className="flex items-start gap-1.5">
                    {level === 'urgent' ? (
                      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                    ) : level === 'watch' ? (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    ) : (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    )}
                    {/* Se envuelve en dos lineas en vez de truncarse. */}
                    <span
                      className={cn(
                        'min-w-0 text-xs leading-snug',
                        level === 'urgent'
                          ? 'font-semibold text-rose-800 dark:text-rose-200'
                          : level === 'watch'
                            ? 'font-semibold text-amber-800 dark:text-amber-200'
                            : 'text-slate-600 dark:text-slate-400'
                      )}
                    >
                      {recommendation}
                    </span>
                  </div>
                </TableCell>

                {/* Acción */}
                <TableCell className={cn(CELL, 'pr-4 text-right')} onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {/* Estaba en `opacity-0 group-hover:opacity-100`: en una
                          pantalla tactil no hay hover, asi que el menu era
                          invisible e inalcanzable. */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        aria-label={`Opciones de ${sub.organization_name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg">
                      <DropdownMenuItem onClick={() => onOpenDetail(sub)} className="cursor-pointer font-semibold">
                        <UserCheck className="mr-2 h-4 w-4 text-violet-600" />
                        Ver ficha y gestionar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onCopyValue(sub.id)} className="cursor-pointer">
                        <Copy className="mr-2 h-3.5 w-3.5 text-slate-400" />
                        Copiar ID de suscripción
                      </DropdownMenuItem>
                      {(sub.provider_subscription_id || sub.provider_customer_id) && (
                        <DropdownMenuItem
                          onClick={() => onCopyValue(sub.provider_subscription_id || sub.provider_customer_id)}
                          className="cursor-pointer"
                        >
                          <Copy className="mr-2 h-3.5 w-3.5 text-slate-400" />
                          Copiar ID externo ({sub.provider})
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {sub.organization_slug && (
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href={`/${sub.organization_slug}/inicio`} target="_blank" rel="noopener noreferrer">
                            <Globe className="mr-2 h-3.5 w-3.5 text-emerald-600" />
                            Abrir tienda pública
                            <ExternalLink className="ml-auto h-3 w-3 text-slate-400" />
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={`/superadmin/organizations?query=${encodeURIComponent(sub.organization_name)}`}>
                          <Users className="mr-2 h-3.5 w-3.5 text-indigo-500" />
                          Ver en Organizaciones
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/superadmin/plans">
                          <Boxes className="mr-2 h-3.5 w-3.5 text-amber-500" />
                          Gestionar planes SaaS
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}

          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="h-40 text-center">
                <div className="flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                  <Boxes className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-semibold">No hay suscripciones que coincidan con los filtros seleccionados.</p>
                  <p className="text-xs">Probá limpiar los filtros o buscar con otro término.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableHead
      className={cn(
        'py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400',
        'whitespace-normal',
        className
      )}
    >
      {children}
    </TableHead>
  )
}

/**
 * Los tres numeros de uso solo se explicaban con un `title`. Un cero sin
 * etiqueta al lado de otros dos ceros no dice nada; el nombre corto abajo sí.
 */
function UsageChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: number | null
}) {
  const count = value ?? 0
  return (
    <span
      title={`${count} ${label}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
        count === 0
          ? 'bg-slate-50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500'
          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      )}
    >
      <Icon className="h-3 w-3 shrink-0 opacity-60" />
      {count}
      <span className="sr-only">{label}</span>
    </span>
  )
}
