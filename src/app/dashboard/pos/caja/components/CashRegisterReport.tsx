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
      <div className="rounded-xl border bg-card p-4 shadow-sm print-hidden">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:w-auto">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Inicio</label>
              <Input
                type="datetime-local"
                value={reportStart}
                onChange={(e) => setReportStart(e.target.value)}
                className="h-9 md:w-[220px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fin</label>
              <Input
                type="datetime-local"
                value={reportEnd}
                onChange={(e) => setReportEnd(e.target.value)}
                className="h-9 md:w-[220px]"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setPresetRange('today')}>
              Hoy
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPresetRange('week')}>
              Semana
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPresetRange('month')}>
              Mes
            </Button>
            <Button size="sm" onClick={generateReport} disabled={isGenerating}>
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
        <Card className="border-dashed">
          <CardContent className="h-52 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <CalendarRange className="h-8 w-8 opacity-40" />
            <p className="font-medium">Seleccione rango y genere el reporte</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card className="xl:col-span-1">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo inicial</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(cashReport.openingBalance || 0)}</p>
              </CardContent>
            </Card>

            <Card className="xl:col-span-1">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-600" /> Ingresos
                </p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{formatCurrency(cashReport.incomes || 0)}</p>
              </CardContent>
            </Card>

            <Card className="xl:col-span-1">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-rose-600" /> Egresos
                </p>
                <p className="text-2xl font-bold mt-1 text-rose-600">{formatCurrency(cashReport.expenses || 0)}</p>
              </CardContent>
            </Card>

            <Card className="xl:col-span-1">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Sigma className="h-3 w-3" /> Neto
                </p>
                <p className={`text-2xl font-bold mt-1 ${netResult >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(netResult)}
                </p>
              </CardContent>
            </Card>

            <Card className="xl:col-span-1">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Saldo final
                </p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(cashReport.closingBalance || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="print-hidden">
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Periodo reportado: <span className="font-medium text-foreground">{cashReport.periodStart || reportStart}</span> a <span className="font-medium text-foreground">{cashReport.periodEnd || reportEnd}</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportReportCSV}>
                  <Download className="h-4 w-4 mr-2" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" /> Imprimir
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!getCurrentRegister.isOpen) return
                    onCloseRegister()
                  }}
                  disabled={!getCurrentRegister.isOpen}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Cierre Z
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {advancedMode ? 'Analisis financiero' : 'Resumen por metodo de cobro'}
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Efectivo</p>
                    <p className="text-xl font-semibold">{formatCurrency(cashReport.cashSales || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Tarjeta</p>
                    <p className="text-xl font-semibold">{formatCurrency(cashReport.cardSales || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Transferencia</p>
                    <p className="text-xl font-semibold">{formatCurrency(cashReport.transferSales || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Mixto</p>
                    <p className="text-xl font-semibold">{formatCurrency(cashReport.mixedSales || 0)}</p>
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

