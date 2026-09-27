/**
 * RepairCard - Card component for grid/kanban views
 * 
 * Clean design with:
 * - Color-coded left border by status
 * - Urgency indicator
 * - Key info at a glance (device, customer, technician, date, cost)
 * - Compact but readable
 */

import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  ShieldCheck,
  User,
  Wrench,
  Zap,
  ImageIcon,
  Phone,
  Package,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Hash,
  FileText,
  PackageX,
  Calendar,
} from 'lucide-react'
import { Repair } from '@/types/repairs'
import { statusConfig, priorityConfig } from '@/config/repair-constants'
import { formatCurrency } from '@/lib/currency'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { WarrantyBadge } from './WarrantyBadge'
import { RepairPaymentIndicator } from './RepairPaymentIndicator'

interface RepairCardProps {
  repair: Repair
  onClick?: () => void
  className?: string
  compact?: boolean
}

const statusBorderColors: Record<string, string> = {
  recibido: 'border-l-amber-500',
  diagnostico: 'border-l-indigo-500',
  reparacion: 'border-l-blue-500',
  pausado: 'border-l-orange-500',
  listo: 'border-l-emerald-500',
  entregado: 'border-l-slate-400 dark:border-l-slate-600',
  cancelado: 'border-l-rose-500',
}

export const RepairCard = memo<RepairCardProps>(
  function RepairCard({ repair, onClick, className, compact = false }) {
    const status = statusConfig[repair.status] || statusConfig.recibido
    const priority = priorityConfig[repair.priority] || priorityConfig.medium
    const imageCount = Array.isArray(repair.images) ? repair.images.length : 0
    const ticketLabel = repair.ticketNumber || repair.id.slice(0, 8)

    // Detección de equipos que no funcionaron o terminaron sin reparación
    const isFailedQuality = repair.qualityCheck?.result === 'failed'
    const isUnrepairable =
      repair.qualityCheck?.result === 'unrepairable' ||
      repair.deliveryOutcome === 'unrepairable' ||
      repair.closeout?.outcome === 'unrepairable'
    const isWithdrawn =
      repair.qualityCheck?.result === 'withdrawn' ||
      repair.deliveryOutcome === 'withdrawn' ||
      repair.closeout?.outcome === 'withdrawn'
    const isCanceled = repair.status === 'cancelado'

    const isUnrepaired = isCanceled || isUnrepairable || isWithdrawn

    // Color distintivo para equipos que no funcionaron
    const cardBorderColor = isFailedQuality || isUnrepairable || isCanceled
      ? 'border-l-rose-500 dark:border-l-rose-600'
      : isWithdrawn
        ? 'border-l-amber-500 dark:border-l-amber-600'
        : (statusBorderColors[repair.status] || 'border-l-muted-foreground/40')

    const cardBgColor = isFailedQuality || isUnrepairable
      ? 'bg-gradient-to-br from-rose-50/60 via-card to-rose-50/20 dark:from-rose-950/30 dark:via-card dark:to-rose-950/15 border-rose-200/90 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-700'
      : isWithdrawn
        ? 'bg-gradient-to-br from-amber-50/50 via-card to-amber-50/20 dark:from-amber-950/25 dark:via-card dark:to-amber-950/15 border-amber-200/80 dark:border-amber-900/50 hover:border-amber-400 dark:hover:border-amber-700'
        : isCanceled
          ? 'bg-muted/40 border-border/80 opacity-90'
          : 'bg-card border-border/70 hover:border-primary/40 dark:hover:border-primary/50'

    const displayCost = isUnrepaired
      ? (repair.closeout?.finalCharge ?? (repair.deliveryOutcome && repair.finalCost && repair.finalCost !== repair.estimatedCost ? repair.finalCost : 0))
      : (repair.finalCost > 0 ? repair.finalCost : repair.estimatedCost)

    const timeAgo = (() => {
      try {
        if (!repair.createdAt) return ''
        const date = new Date(repair.createdAt)
        if (isNaN(date.getTime())) return ''
        return formatDistanceToNow(date, { addSuffix: false, locale: es })
      } catch {
        return ''
      }
    })()

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onClick) return

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onClick()
      }
    }

    return (
      <Card
        className={cn(
          'group relative text-card-foreground transition-all duration-200 shadow-2xs hover:shadow-md overflow-hidden',
          compact ? 'rounded-lg border border-l-[3.5px]' : 'rounded-xl border border-l-[4px]',
          onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          cardBorderColor,
          cardBgColor,
          className
        )}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? `Abrir reparacion ${ticketLabel} de ${repair.customer.name}` : undefined}
      >
        <CardContent className={cn("flex flex-col h-full", compact ? "p-2 space-y-1" : "p-3.5 space-y-2.5")}>
          {/* Header Row: Ticket ID + chips de estado especial + Urgencia/Prioridad */}
          <div className={cn("flex items-center justify-between gap-1", !compact && "pr-7")}>
            <div className="flex items-center gap-1 min-w-0 flex-wrap">
              <span className={cn(
                "font-mono font-bold text-muted-foreground/90 bg-muted/80 dark:bg-muted/50 rounded border border-border/50 tracking-tight shrink-0",
                compact ? "text-[9px] px-1 py-0.2" : "text-[11px] px-1.5 py-0.5"
              )}>
                #{ticketLabel}
              </span>

              {repair.parentRepairId && (
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-0.5 border-blue-200 bg-blue-50/90 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 shrink-0 font-semibold",
                    compact ? "h-4 px-1 text-[8.5px]" : "h-5 px-1.5 py-0 text-[10px]"
                  )}
                  title="Retrabajo generado por un reclamo de garantía"
                >
                  <ShieldCheck className={compact ? "h-2 w-2" : "h-3 w-3"} />
                  Garantía
                </Badge>
              )}

              {/* Badges de equipos que no funcionaron (destacados en la tarjeta) */}
              {!compact && isFailedQuality && (
                <Badge
                  variant="outline"
                  className="gap-1 text-[10px] font-bold border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300 shrink-0"
                >
                  <XCircle className="h-3 w-3 shrink-0" />
                  No funcionó
                </Badge>
              )}

              {!compact && isUnrepairable && (
                <Badge
                  variant="outline"
                  className="gap-1 text-[10px] font-bold border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300 shrink-0"
                >
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Sin solución
                </Badge>
              )}

              {!compact && isWithdrawn && (
                <Badge
                  variant="outline"
                  className="gap-1 text-[10px] font-bold border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300 shrink-0"
                >
                  <PackageX className="h-3 w-3 shrink-0" />
                  Retirado sin reparar
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {repair.urgency === 'urgent' ? (
                <Badge variant="destructive" className={cn(
                  "font-bold gap-0.5 shadow-2xs bg-rose-600 hover:bg-rose-700 text-white",
                  compact ? "text-[8.5px] px-1 py-0 h-4" : "text-[10px] px-1.5 py-0 h-5"
                )}>
                  <Zap className={compact ? "h-2 w-2 fill-current" : "h-2.5 w-2.5 fill-current"} />
                  Urgente
                </Badge>
              ) : (
                <Badge variant="outline" className={cn(
                  "font-medium border-border/70 text-muted-foreground bg-muted/30",
                  compact ? "text-[8.5px] px-1 py-0 h-4" : "text-[10px] px-1.5 py-0 h-5"
                )}>
                  {priority.icon} {priority.label}
                </Badge>
              )}
              {compact && timeAgo && (
                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/75 font-normal ml-0.5" title={timeAgo}>
                  <Clock className="h-2 w-2" />
                  {timeAgo}
                </span>
              )}
            </div>
          </div>

          {/* Device Title & Serial/IMEI */}
          <div className="min-w-0">
            <h4 className={cn(
              "font-bold text-foreground tracking-tight truncate group-hover:text-primary transition-colors leading-tight",
              compact ? "text-[11px]" : "text-sm line-clamp-1"
            )}>
              {repair.device}
            </h4>
            {!compact && (repair.serialNumber || repair.imei) && (
              <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground/75 mt-0.5">
                <Hash className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                <span className="truncate">S/N: {repair.serialNumber || repair.imei}</span>
              </div>
            )}
          </div>

          {/* Issue description & Diagnostic details */}
          {compact ? (
            <p className="text-[10px] text-muted-foreground truncate leading-tight">
              {repair.issue}
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-normal bg-muted/25 dark:bg-muted/15 px-2.5 py-1.5 rounded-md border border-border/40">
                {repair.issue}
              </p>
              {repair.description && repair.description.trim() !== repair.issue.trim() && (
                <div className="text-[11px] text-muted-foreground/90 bg-muted/30 dark:bg-muted/15 px-2 py-1 rounded border border-border/30 flex items-start gap-1.5">
                  <FileText className="h-3 w-3 text-muted-foreground/60 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">Diagnóstico: {repair.description}</span>
                </div>
              )}
            </div>
          )}

          {/* Customer + Technician */}
          {compact ? (
            <div className="flex items-center justify-between text-[10px] gap-1 pt-0.5 border-t border-border/25">
              <div className="flex items-center gap-1 min-w-0 text-foreground/85">
                <User className="h-2.5 w-2.5 text-muted-foreground/70 shrink-0" />
                <span className="truncate font-medium max-w-[95px]">{repair.customer.name}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                <Wrench className="h-2.5 w-2.5 shrink-0" />
                {repair.technician?.name ? (
                  <span className="truncate font-medium text-foreground/80 max-w-[80px]">{repair.technician.name}</span>
                ) : (
                  <span className="font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded px-1 text-[8.5px]">
                    Sin técnico
                  </span>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Customer + Contact */}
              <div className="flex items-center justify-between text-xs gap-1.5 pt-0.5">
                <div className="flex items-center gap-1.5 min-w-0 text-foreground/90">
                  <User className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                  <span className="truncate font-medium text-xs">{repair.customer.name}</span>
                </div>
                {repair.customer.phone && (
                  <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 shrink-0">
                    <Phone className="h-3 w-3 text-muted-foreground/60" />
                    {repair.customer.phone}
                  </span>
                )}
              </div>

              {/* Technician & Meta Details */}
              <div className="flex items-center justify-between text-xs gap-1.5 pt-0.5">
                <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <Wrench className="h-3 w-3 shrink-0" />
                  {repair.technician?.name ? (
                    <span className="truncate font-medium text-foreground/80 text-xs max-w-[120px]">{repair.technician.name}</span>
                  ) : (
                    <span className="font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded border border-amber-500/20 text-[10px] px-1.5 py-0.5">
                      Sin técnico
                    </span>
                  )}
                </div>

                {/* Meta badges en vista card: piezas, notas, fotos */}
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                  {(repair.parts || []).length > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted/40 border border-border/40 font-medium" title={`${repair.parts?.length} repuesto(s)`}>
                      <Package className="h-3 w-3 text-muted-foreground/70" />
                      {repair.parts?.length}
                    </span>
                  )}
                  {(repair.notes || []).length > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted/40 border border-border/40 font-medium" title={`${repair.notes?.length} nota(s)`}>
                      <MessageSquare className="h-3 w-3 text-muted-foreground/70" />
                      {repair.notes?.length}
                    </span>
                  )}
                  {imageCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted/40 border border-border/40 font-medium" title={`${imageCount} foto(s)`}>
                      <ImageIcon className="h-3 w-3 text-muted-foreground/70" />
                      {imageCount}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Payment & Financial status indicator */}
          <div className={cn("space-y-0.5", !compact && "pt-1 space-y-1")}>
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <RepairPaymentIndicator
                compact
                status={repair.status}
                finalCost={repair.finalCost}
                estimatedCost={repair.estimatedCost}
                paidAmount={repair.paidAmount}
                deliveryOutcome={repair.deliveryOutcome}
                qualityCheck={repair.qualityCheck}
                closeout={repair.closeout}
              />
              {displayCost > 0 && (
                <span className={cn(
                  "font-bold text-foreground tabular-nums bg-muted/60 dark:bg-muted/40 px-1 py-0.2 rounded border border-border/50 ml-auto shrink-0",
                  compact ? "text-[10px]" : "text-xs px-1.5 py-0.5"
                )}>
                  {formatCurrency(displayCost)}
                </span>
              )}
            </div>
            {!compact && repair.paidAmount && repair.paidAmount > 0 && displayCost > repair.paidAmount && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40 tabular-nums">
                <span>Abonado: {formatCurrency(repair.paidAmount)}</span>
                <span className="font-semibold text-foreground/90">Saldo: {formatCurrency(displayCost - repair.paidAmount)}</span>
              </div>
            )}
          </div>

          {/* Footer for non-compact, or compact minimal warranty if applicable */}
          {!compact ? (
            <div className="flex items-center justify-between pt-2.5 border-t border-border/60 gap-1.5 flex-wrap mt-auto">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn('text-[10px] font-semibold px-2 py-0.5 h-5 rounded-md border', status.color)}
                >
                  {status.label}
                </Badge>
                {(repair.warrantyExpiresAt || (repair.warrantyMonths && repair.warrantyMonths > 0)) && (
                  <WarrantyBadge repair={repair} size="sm" showDaysRemaining />
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0 ml-auto">
                {repair.createdAt && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/80">
                    <Calendar className="h-3 w-3" />
                    {new Date(repair.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
                  </span>
                )}
                {timeAgo && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/80">
                    <Clock className="h-3 w-3" />{timeAgo}
                  </span>
                )}
              </div>
            </div>
          ) : (
            (repair.warrantyExpiresAt || (repair.warrantyMonths && repair.warrantyMonths > 0)) && (
              <div className="pt-1 border-t border-border/40 flex items-center justify-between">
                <WarrantyBadge repair={repair} size="sm" showDaysRemaining />
              </div>
            )
          )}
        </CardContent>
      </Card>
    )
  },
  (prevProps, nextProps) => {
    const prev = prevProps.repair
    const next = nextProps.repair
    if (prev === next) return true

    const prevImageCount = Array.isArray(prev.images) ? prev.images.length : 0
    const nextImageCount = Array.isArray(next.images) ? next.images.length : 0
    const prevPartsCount = Array.isArray(prev.parts) ? prev.parts.length : 0
    const nextPartsCount = Array.isArray(next.parts) ? next.parts.length : 0
    const prevNotesCount = Array.isArray(prev.notes) ? prev.notes.length : 0
    const nextNotesCount = Array.isArray(next.notes) ? next.notes.length : 0

    return (
      prevProps.compact === nextProps.compact &&
      prev.id === next.id &&
      prev.status === next.status &&
      prev.paidAmount === next.paidAmount &&
      prev.finalCost === next.finalCost &&
      prev.estimatedCost === next.estimatedCost &&
      prev.priority === next.priority &&
      prev.urgency === next.urgency &&
      prev.lastUpdate === next.lastUpdate &&
      prev.technician?.id === next.technician?.id &&
      prev.deliveryOutcome === next.deliveryOutcome &&
      prev.qualityCheck?.result === next.qualityCheck?.result &&
      prevImageCount === nextImageCount &&
      prevPartsCount === nextPartsCount &&
      prevNotesCount === nextNotesCount
    )
  }
)

RepairCard.displayName = 'RepairCard'
