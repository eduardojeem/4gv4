'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCcw, Download, Printer, CalendarRange, TrendingUp, TrendingDown, Wallet, Sigma, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext } from '../../contexts/CashRegisterContext'
import { useCashRegisterReport } from '../../hooks/useCashRegisterReport'
import { CashRegisterCharts } from '../../components/CashRegisterCharts'

interface CashRegisterReportProps {
  onCloseRegister: () => void
  advancedMode?: boolean
}

export function CashRegisterReport({ onCloseRegister, advancedMode = false }: CashRegisterReportProps) {
  const { cashReport, getCurrentRegister } = useCashRegisterContext()
  const {
    reportStart,
    setReportStart,
    reportEnd,
    setReportEnd,
    setPresetRange,
    generateReport,
    exportReportCSV,
    isGenerating
  } = useCashRegisterReport()

  const netResult = useMemo(() => {
    if (!cashReport) return 0
    return (cashReport.incomes || 0) - (cashReport.expenses || 0)
  }, [cashReport])

  return (
    <div className="space-y-6 print-content animate-in fade-in duration-300">
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm print-hidden">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:w-auto">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Inicio</label>
              <Input
                type="datetime-local"
                value={reportStart}
                onChange={(e) => setReportStart(e.target.value)}
                className="h-9 md:w-[220px] bg-muted/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fin</label>
              <Input
                type="datetime-local"
                value={reportEnd}
                onChange={(e) => setReportEnd(e.target.value)}
                className="h-9 md:w-[220px] bg-muted/30"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="bg-muted/50 p-1 rounded-md flex gap-1 mr-2">
              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setPresetRange('today')}>
                Hoy
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setPresetRange('week')}>
                Semana
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setPresetRange('month')}>
                Mes
              </Button>
            </div>
            <Button size="sm" onClick={generateReport} disabled={isGenerating} className="shadow-sm">
              <RefreshCcw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Generar
            </Button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 1cm; size: portrait; }
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content { position: absolute; left: 0; top: 0; width: 100%; }
          .print-hidden { display: none !important; }
        }
      `}</style>

      {!cashReport ? (
        <Card className="border-dashed border-2 bg-muted/20">
          <CardContent className="h-52 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-border/50">
              <CalendarRange className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <p className="font-medium text-sm">Seleccione rango y genere el reporte</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card className="border border-slate-200/80 dark:border-slate-800/60 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-900/20 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/40">
                    <Wallet className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Saldo inicial</p>
                </div>
                <p className="text-2xl font-bold tracking-tight tabular-nums mt-1">{formatCurrency(cashReport.openingBalance || 0)}</p>
              </CardContent>
            </Card>

            <Card className="border border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-900 dark:text-emerald-400">Ingresos</p>
                </div>
                <p className="text-2xl font-bold tracking-tight tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">{formatCurrency(cashReport.incomes || 0)}</p>
              </CardContent>
            </Card>

            <Card className="border border-rose-200/80 dark:border-rose-800/60 bg-gradient-to-br from-rose-50/50 to-transparent dark:from-rose-950/20 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/40">
                    <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-rose-900 dark:text-rose-400">Egresos</p>
                </div>
                <p className="text-2xl font-bold tracking-tight tabular-nums mt-1 text-rose-700 dark:text-rose-400">{formatCurrency(cashReport.expenses || 0)}</p>
              </CardContent>
            </Card>

            <Card className={`border shadow-sm ${netResult >= 0 ? 'border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20' : 'border-rose-200/80 dark:border-rose-800/60 bg-gradient-to-br from-rose-50/50 to-transparent dark:from-rose-950/20'}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${netResult >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-rose-100 dark:bg-rose-900/40'}`}>
                    <Sigma className={`h-4 w-4 ${netResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} />
                  </div>
                  <p className={`text-[11px] uppercase tracking-wide font-semibold ${netResult >= 0 ? 'text-emerald-900 dark:text-emerald-400' : 'text-rose-900 dark:text-rose-400'}`}>Neto</p>
                </div>
                <p className={`text-2xl font-bold tracking-tight tabular-nums mt-1 ${netResult >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {formatCurrency(netResult)}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-blue-200/80 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                    <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-blue-900 dark:text-blue-400">Saldo final</p>
                </div>
                <p className="text-2xl font-bold tracking-tight tabular-nums mt-1 text-blue-700 dark:text-blue-300">{formatCurrency(cashReport.closingBalance || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="print-hidden border-border/60 shadow-sm">
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <CalendarRange className="h-4 w-4" />
                <span>
                  Periodo reportado: <span className="font-semibold text-foreground">{cashReport.periodStart || reportStart}</span> a <span className="font-semibold text-foreground">{cashReport.periodEnd || reportEnd}</span>
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={exportReportCSV} className="bg-white dark:bg-gray-950">
                  <Download className="h-4 w-4 mr-2" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-white dark:bg-gray-950">
                  <Printer className="h-4 w-4 mr-2" /> Imprimir
                </Button>
                <div className="w-px h-8 bg-border mx-1 hidden md:block"></div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (!getCurrentRegister.isOpen) return
                    onCloseRegister()
                  }}
                  disabled={!getCurrentRegister.isOpen}
                  className="shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Cierre Z
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/40 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center">
                {advancedMode ? <TrendingUp className="mr-2 h-4 w-4 text-blue-600" /> : <Wallet className="mr-2 h-4 w-4 text-blue-600" />}
                {advancedMode ? 'Análisis financiero' : 'Resumen por método de cobro'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {advancedMode ? (
                <CashRegisterCharts
                  cashReport={cashReport}
                  precalculatedTotals={{
                    cash: cashReport.cashSales || 0,
                    card: cashReport.cardSales || 0,
                    transfer: cashReport.transferSales || 0,
                    mixed: cashReport.mixedSales || 0
                  }}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col justify-between shadow-sm">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Efectivo</p>
                    <p className="text-2xl font-bold tabular-nums">{formatCurrency(cashReport.cashSales || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col justify-between shadow-sm">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tarjeta</p>
                    <p className="text-2xl font-bold tabular-nums">{formatCurrency(cashReport.cardSales || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col justify-between shadow-sm">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Transferencia</p>
                    <p className="text-2xl font-bold tabular-nums">{formatCurrency(cashReport.transferSales || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col justify-between shadow-sm">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Mixto / Otros</p>
                    <p className="text-2xl font-bold tabular-nums">{formatCurrency(cashReport.mixedSales || 0)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
