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
  Wallet
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Historial de Operaciones</h3>
          <p className="text-sm text-muted-foreground">Cierres recientes con estado, ventas y diferencias de caja</p>
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenFullHistory}
            className="flex-1 lg:flex-none"
          >
            <History className="h-4 w-4 mr-2 text-blue-600" />
            Ver historial completo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenAudit}
            className="flex-1 lg:flex-none"
          >
            <Shield className="h-4 w-4 mr-2 text-violet-600" />
            Ir a auditoria
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="xl:col-span-1 border-l-4 border-l-blue-500">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total cierres</p>
            <p className="text-2xl font-bold mt-1">{summary.total}</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1 border-l-4 border-l-emerald-500">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sin diferencia</p>
            <p className="text-2xl font-bold mt-1 text-emerald-700">{summary.perfect}</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1 border-l-4 border-l-amber-500">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Con diferencia</p>
            <p className="text-2xl font-bold mt-1 text-amber-700">{summary.withDiff}</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1 border-l-4 border-l-violet-500">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Ventas acumuladas
            </p>
            <p className="text-lg font-bold mt-1">{formatCurrency(summary.totalSales)}</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1 border-l-4 border-l-rose-500">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" />
              Diferencia acumulada
            </p>
            <p className="text-lg font-bold mt-1 text-rose-700">{formatCurrency(summary.totalDiscrepancy)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-none bg-white dark:bg-gray-950">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-medium flex items-center">
            <FileText className="h-4 w-4 mr-2 text-gray-500" />
            Ultimos cierres
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {recentClosures.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <History className="h-12 w-12 opacity-20 mb-3" />
              <p>No hay cierres registrados todavia</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {recentClosures.map((closure) => {
                const date = new Date(closure.date)
                const isPerfect = Math.abs(closure.discrepancy) < 1

                return (
                  <button
                    key={closure.id}
                    type="button"
                    onClick={onOpenFullHistory}
                    className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`mt-1 p-2 rounded-lg ${isPerfect ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {isPerfect ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        </div>

                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            Cierre del {date.toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center mt-0.5">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(closure.closedAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                            <span className="mx-1">-</span>
                            Por: {closure.closedBy || 'Usuario no identificado'}
                          </p>

                          {!isPerfect && (
                            <Badge variant="outline" className="mt-2 text-amber-700 border-amber-200 bg-amber-50">
                              Diferencia: {closure.discrepancy > 0 ? '+' : ''}{formatCurrency(closure.discrepancy)}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Ventas</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(closure.totalSales)}</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground">Saldo final</p>
                          <p className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(closure.closingBalance)}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
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

