'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  History,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  FileText,
  ChevronRight,
  TrendingUp,
  Wallet,
  Activity
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext, ZClosureRecord } from '../../contexts/CashRegisterContext'

interface CashRegisterHistoryProps {
  onOpenFullHistory: () => void
  onOpenAudit: () => void
}

function byClosedAtDesc(a: ZClosureRecord, b: ZClosureRecord) {
  return new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
}

export function CashRegisterHistory({ onOpenFullHistory, onOpenAudit }: CashRegisterHistoryProps) {
  const { zClosureHistory } = useCashRegisterContext()

  const sortedHistory = useMemo(() => {
    return [...zClosureHistory].sort(byClosedAtDesc)
  }, [zClosureHistory])

  const recentClosures = useMemo(() => sortedHistory.slice(0, 6), [sortedHistory])

  const summary = useMemo(() => {
    const total = sortedHistory.length
    const perfect = sortedHistory.filter((c) => Math.abs(c.discrepancy) < 1).length
    const withDiff = total - perfect
    const totalSales = sortedHistory.reduce((sum, c) => sum + c.totalSales, 0)
    const avgSales = total > 0 ? totalSales / total : 0
    const totalDiscrepancy = sortedHistory.reduce((sum, c) => sum + Math.abs(c.discrepancy), 0)
    return { total, perfect, withDiff, totalSales, avgSales, totalDiscrepancy }
  }, [sortedHistory])

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div>
          <h3 className="text-lg font-medium text-foreground">Historial de Operaciones</h3>
          <p className="text-sm text-muted-foreground">Cierres recientes con estado, ventas y diferencias de caja</p>
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenFullHistory}
            className="flex-1 lg:flex-none bg-white dark:bg-gray-950 shadow-sm"
          >
            <History className="h-4 w-4 mr-2 text-blue-600" />
            Ver historial completo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenAudit}
            className="flex-1 lg:flex-none bg-white dark:bg-gray-950 shadow-sm"
          >
            <Shield className="h-4 w-4 mr-2 text-violet-600" />
            Ir a auditoría
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border border-slate-200/80 dark:border-slate-800/60 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-900/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/40">
                <History className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Total cierres</p>
            </div>
            <p className="text-2xl font-bold mt-1 tabular-nums">{summary.total}</p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-900 dark:text-emerald-400">Sin diferencia</p>
            </div>
            <p className="text-2xl font-bold mt-1 tabular-nums text-emerald-700 dark:text-emerald-400">{summary.perfect}</p>
          </CardContent>
        </Card>

        <Card className="border border-amber-200/80 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-[11px] uppercase tracking-wide font-semibold text-amber-900 dark:text-amber-400">Con diferencia</p>
            </div>
            <p className="text-2xl font-bold mt-1 tabular-nums text-amber-700 dark:text-amber-400">{summary.withDiff}</p>
          </CardContent>
        </Card>

        <Card className="border border-blue-200/80 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-[11px] uppercase tracking-wide font-semibold text-blue-900 dark:text-blue-400">Ventas acum.</p>
            </div>
            <p className="text-2xl font-bold mt-1 tabular-nums text-blue-700 dark:text-blue-400">{formatCurrency(summary.totalSales)}</p>
          </CardContent>
        </Card>

        <Card className="border border-rose-200/80 dark:border-rose-800/60 bg-gradient-to-br from-rose-50/50 to-transparent dark:from-rose-950/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/40">
                <Wallet className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <p className="text-[11px] uppercase tracking-wide font-semibold text-rose-900 dark:text-rose-400">Dif. acumulada</p>
            </div>
            <p className="text-2xl font-bold mt-1 tabular-nums text-rose-700 dark:text-rose-400">{formatCurrency(summary.totalDiscrepancy)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border/60 overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center">
            <FileText className="h-4 w-4 mr-2 text-slate-500" />
            Últimos cierres
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {recentClosures.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-card">
              <div className="p-4 bg-muted/50 rounded-full mb-3">
                <Activity className="h-8 w-8 opacity-40" />
              </div>
              <p className="font-medium text-sm">No hay cierres registrados todavía</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {recentClosures.map((closure) => {
                const date = new Date(closure.date)
                const isPerfect = Math.abs(closure.discrepancy) < 1

                return (
                  <button
                    key={closure.id}
                    type="button"
                    onClick={onOpenFullHistory}
                    className="w-full text-left p-4 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`mt-0.5 p-2 rounded-lg border ${isPerfect ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400'}`}>
                          {isPerfect ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">
                            Cierre del {date.toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(closure.closedAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="flex items-center">
                              <span className="h-1 w-1 rounded-full bg-muted-foreground mr-1.5" />
                              Por: {closure.closedBy || 'Sistema'}
                            </span>
                          </div>

                          {!isPerfect && (
                            <div className="mt-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${closure.discrepancy > 0 ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'}`}>
                                Diferencia: {closure.discrepancy > 0 ? '+' : ''}{formatCurrency(closure.discrepancy)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-sm ml-11 sm:ml-0">
                        <div className="text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Ventas</p>
                          <p className="font-bold tabular-nums text-foreground">{formatCurrency(closure.totalSales)}</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Saldo final</p>
                          <p className="font-semibold tabular-nums text-muted-foreground">{formatCurrency(closure.closingBalance)}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors hidden sm:block" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
