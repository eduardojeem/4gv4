'use client'

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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
  Activity,
  HelpCircle
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext, ZClosureRecord } from '../../contexts/CashRegisterContext'
import { CashRegisterGuideDialog } from './CashRegisterGuideDialog'

interface CashRegisterHistoryProps {
  onOpenFullHistory: () => void
  onOpenAudit: () => void
}

function byClosedAtDesc(a: ZClosureRecord, b: ZClosureRecord) {
  return new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
}

export function CashRegisterHistory({ onOpenFullHistory, onOpenAudit }: CashRegisterHistoryProps) {
  const [showGuide, setShowGuide] = useState(false)
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('week')
  const { zClosureHistory } = useCashRegisterContext()

  const sortedHistory = useMemo(() => {
    return [...zClosureHistory].sort(byClosedAtDesc)
  }, [zClosureHistory])

  const filteredHistory = useMemo(() => {
    const now = new Date()
    let cutoff: Date | null = null

    if (period === 'today') {
      cutoff = new Date(now)
      cutoff.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      cutoff = new Date(now)
      cutoff.setDate(now.getDate() - 7)
    } else if (period === 'month') {
      cutoff = new Date(now)
      cutoff.setMonth(now.getMonth() - 1)
    } else if (period === 'year') {
      cutoff = new Date(now)
      cutoff.setFullYear(now.getFullYear() - 1)
    }

    if (!cutoff) return sortedHistory
    return sortedHistory.filter(c => new Date(c.closedAt || c.date) >= cutoff!)
  }, [sortedHistory, period])

  const recentClosures = useMemo(() => filteredHistory.slice(0, 8), [filteredHistory])

  const summary = useMemo(() => {
    const total = filteredHistory.length
    const perfect = filteredHistory.filter((c) => Math.abs(c.discrepancy) < 1).length
    const withDiff = total - perfect
    const totalSales = filteredHistory.reduce((sum, c) => sum + c.totalSales, 0)
    const avgSales = total > 0 ? totalSales / total : 0

    const totalOver = filteredHistory
      .filter((c) => c.discrepancy > 0.5)
      .reduce((sum, c) => sum + c.discrepancy, 0)

    const totalShort = filteredHistory
      .filter((c) => c.discrepancy < -0.5)
      .reduce((sum, c) => sum + Math.abs(c.discrepancy), 0)

    const netDiscrepancy = filteredHistory.reduce((sum, c) => sum + (c.discrepancy || 0), 0)

    return { total, perfect, withDiff, totalSales, avgSales, totalOver, totalShort, netDiscrepancy }
  }, [filteredHistory])

  const isNetOver = summary.netDiscrepancy > 0.5
  const isNetShort = summary.netDiscrepancy < -0.5

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuide(true)}
            className="gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 text-xs font-semibold rounded-xl"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>¿Cómo funciona?</span>
          </Button>
        </div>
      </div>

      {/* Selector de Período Rápido */}
      <div className="flex items-center justify-between p-2 rounded-2xl border border-border/60 bg-muted/20 gap-2 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-2">Período de Visualización:</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: 'today', label: 'Hoy' },
            { key: 'week', label: 'Esta Semana (Por Defecto)' },
            { key: 'month', label: 'Este Mes' },
            { key: 'year', label: 'Este Año' },
            { key: 'all', label: 'Todo el Historial' }
          ].map(p => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={period === p.key ? 'default' : 'outline'}
              onClick={() => setPeriod(p.key as any)}
              className="h-7 text-xs px-3 rounded-xl font-medium"
            >
              {p.label}
            </Button>
          ))}
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

        <Card
          className={`border shadow-sm transition-colors ${
            isNetShort
              ? 'border-rose-200/80 dark:border-rose-800/60 bg-gradient-to-br from-rose-50/60 to-transparent dark:from-rose-950/30'
              : isNetOver
              ? 'border-amber-200/80 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/30'
              : 'border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/60 to-transparent dark:from-emerald-950/30'
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-lg ${
                    isNetShort
                      ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                      : isNetOver
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide font-bold text-foreground">Dif. acumulada</p>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  isNetShort
                    ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300'
                    : isNetOver
                    ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {isNetShort ? 'Faltante Neto' : isNetOver ? 'Sobrante Neto' : 'Exacto'}
              </span>
            </div>

            <p
              className={`text-xl sm:text-2xl font-black mt-1 tabular-nums ${
                isNetShort
                  ? 'text-rose-600 dark:text-rose-400'
                  : isNetOver
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isNetOver ? `+${formatCurrency(summary.netDiscrepancy)}` : isNetShort ? `-${formatCurrency(Math.abs(summary.netDiscrepancy))}` : 'Gs. 0'}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
              {summary.totalOver > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  ▲ +{formatCurrency(summary.totalOver)}
                </span>
              )}
              {summary.totalShort > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-medium">
                  ▼ -{formatCurrency(summary.totalShort)}
                </span>
              )}
              {summary.totalOver === 0 && summary.totalShort === 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Sin variaciones en turnos
                </span>
              )}
            </div>
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

      <CashRegisterGuideDialog
        open={showGuide}
        onOpenChange={setShowGuide}
        initialSection="history"
      />
    </div>
  )
}
