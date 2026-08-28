'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Clock,
} from 'lucide-react'
import type { Promotion, PromotionFilters } from '@/types/promotion'

type AlertFilter = Exclude<PromotionFilters['alert'], 'all'>

interface PromotionAlertsProps {
  expiringSoon: Promotion[]
  unused: Promotion[]
  expiredActive: Promotion[]
  onCleanupExpired?: () => void
  onEdit?: (promotion: Promotion) => void
  onViewAll?: (alert: AlertFilter) => void
}

export function PromotionAlerts({
  expiringSoon,
  unused,
  expiredActive,
  onCleanupExpired,
  onEdit,
  onViewAll,
}: PromotionAlertsProps) {
  const hasAlerts = expiringSoon.length > 0 || unused.length > 0 || expiredActive.length > 0
  const [collapsed, setCollapsed] = useState(false)

  if (!hasAlerts) {
    return null
  }

  const totalAlerts = expiredActive.length + expiringSoon.length + unused.length

  return (
    <div className="space-y-3">
      {/* Alerts Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold">
            !
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Alertas de Promociones ({totalAlerts})
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          {collapsed ? (
            <>
              Mostrar alertas <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Ocultar <ChevronUp className="ml-1 h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>

      {!collapsed && (
        <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {/* Expired but still active */}
          {expiredActive.length > 0 && (
            <Card className="rounded-2xl border-rose-200/80 bg-rose-50/40 shadow-xs dark:border-rose-900/40 dark:bg-rose-950/20">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-rose-600" />
                    <CardTitle className="text-xs font-bold text-rose-900 dark:text-rose-200">
                      Expiradas pero Activas
                    </CardTitle>
                  </div>
                  <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-bold">
                    {expiredActive.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  Ya vencieron pero siguen habilitadas.
                </p>
                <div className="space-y-1.5 pt-1">
                  {expiredActive.slice(0, 2).map((promo) => (
                    <div
                      key={promo.id}
                      className="flex items-center justify-between rounded-lg border border-rose-200/80 bg-white/90 p-2 text-xs dark:border-rose-900/50 dark:bg-slate-900/80"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{promo.name}</p>
                        <code className="text-[10px] text-slate-400">{promo.code}</code>
                      </div>
                      {onEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(promo)}
                          className="h-6 px-2 text-[11px] text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-950"
                        >
                          Ver
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2">
                  {onCleanupExpired && (
                    <Button
                      size="sm"
                      onClick={onCleanupExpired}
                      className="h-7 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-3"
                    >
                      <Sparkles className="mr-1 h-3 w-3" /> Desactivar todas
                    </Button>
                  )}
                  {expiredActive.length > 2 && onViewAll && (
                    <button
                      type="button"
                      onClick={() => onViewAll('expired_active')}
                      className="text-xs font-semibold text-rose-700 hover:underline dark:text-rose-300 ml-auto"
                    >
                      Ver todas ({expiredActive.length}) →
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expiring soon */}
          {expiringSoon.length > 0 && (
            <Card className="rounded-2xl border-amber-200/80 bg-amber-50/40 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/20">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <CardTitle className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Por Expirar (&lt; 7 días)
                    </CardTitle>
                  </div>
                  <Badge className="h-5 px-1.5 text-[10px] font-bold bg-amber-500 text-slate-950">
                    {expiringSoon.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Próximas a vencer. Considera extender la fecha.
                </p>
                <div className="space-y-1.5 pt-1">
                  {expiringSoon.slice(0, 2).map((promo) => (
                    <div
                      key={promo.id}
                      className="flex items-center justify-between rounded-lg border border-amber-200/80 bg-white/90 p-2 text-xs dark:border-amber-900/50 dark:bg-slate-900/80"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{promo.name}</p>
                        <code className="text-[10px] text-slate-400">{promo.code}</code>
                      </div>
                      {onEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(promo)}
                          className="h-6 px-2 text-[11px] text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950"
                        >
                          Extender
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {expiringSoon.length > 2 && onViewAll && (
                  <div className="pt-2 text-right">
                    <button
                      type="button"
                      onClick={() => onViewAll('expiring_soon')}
                      className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300"
                    >
                      Ver todas ({expiringSoon.length}) →
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Unused promotions */}
          {unused.length > 0 && (
            <Card className="rounded-2xl border-cyan-200/80 bg-cyan-50/40 shadow-xs dark:border-cyan-900/40 dark:bg-cyan-950/20">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-cyan-600" />
                    <CardTitle className="text-xs font-bold text-cyan-900 dark:text-cyan-200">
                      Sin Utilizar
                    </CardTitle>
                  </div>
                  <Badge className="h-5 px-1.5 text-[10px] font-bold bg-cyan-600 text-white">
                    {unused.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <p className="text-xs text-cyan-700 dark:text-cyan-300">
                  Están activas pero ningún cliente las ha usado.
                </p>
                <div className="space-y-1.5 pt-1">
                  {unused.slice(0, 2).map((promo) => (
                    <div
                      key={promo.id}
                      className="flex items-center justify-between rounded-lg border border-cyan-200/80 bg-white/90 p-2 text-xs dark:border-cyan-900/50 dark:bg-slate-900/80"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{promo.name}</p>
                        <code className="text-[10px] text-slate-400">{promo.code}</code>
                      </div>
                      {onEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(promo)}
                          className="h-6 px-2 text-[11px] text-cyan-700 hover:bg-cyan-100 dark:text-cyan-300 dark:hover:bg-cyan-950"
                        >
                          Revisar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {unused.length > 2 && onViewAll && (
                  <div className="pt-2 text-right">
                    <button
                      type="button"
                      onClick={() => onViewAll('unused')}
                      className="text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
                    >
                      Ver todas ({unused.length}) →
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
