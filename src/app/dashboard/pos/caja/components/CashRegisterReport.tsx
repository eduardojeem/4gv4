'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCcw, Download, Save } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext } from '../../contexts/CashRegisterContext'
import { useCashRegisterReport } from '../../hooks/useCashRegisterReport'
import { CashRegisterCharts } from '../../components/CashRegisterCharts'

interface CashRegisterReportProps {
    onCloseRegister: () => void
}

export function CashRegisterReport({ onCloseRegister }: CashRegisterReportProps) {
    const { cashReport, getCurrentRegister } = useCashRegisterContext()
    const {
        reportStart,
        setReportStart,
        reportEnd,
        setReportEnd,
        generateReport,
        exportReportCSV,
        isGenerating
    } = useCashRegisterReport()

    return (
        <div className="space-y-6 print-content animate-in fade-in duration-500">
            {/* Filter Toolbar */}
            <div className="bg-white rounded-xl border p-2 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between print-hidden">
                <div className="flex items-center gap-4 flex-1 w-full md:w-auto px-2">
                    <div className="flex flex-col gap-1 w-full md:w-auto">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inicio Periodo</label>
                        <Input
                            type="datetime-local"
                            value={reportStart}
                            onChange={e => setReportStart(e.target.value)}
                            className="h-9 w-full md:w-[200px] bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-1 w-full md:w-auto">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fin Periodo</label>
                        <Input
                            type="datetime-local"
                            value={reportEnd}
                            onChange={e => setReportEnd(e.target.value)}
                            className="h-9 w-full md:w-[200px] bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                        />
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto px-2">
                    <Button
                        size="sm"
                        onClick={generateReport}
                        disabled={isGenerating}
                        className="flex-1 md:flex-none bg-primary text-primary-foreground shadow hover:shadow-md transition-all"
                    >
                        <RefreshCcw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                        Generar Reporte
                    </Button>
                    <div className="flex bg-gray-100 rounded-md p-1 gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-white shadow-sm" onClick={exportReportCSV} disabled={!cashReport} title="Exportar CSV">
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-white shadow-sm" onClick={() => window.print()} disabled={!cashReport} title="Imprimir">
                            <Save className="h-4 w-4" /> {/* Use generic icon for print if specific not available, logic handles print */}
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
                    .bg-gradient-to-br { background: none !important; border: 1px solid #ddd; }
                    .text-white { color: black !important; }
                }
            `}</style>

            {cashReport ? (
                <div className="grid gap-6">
                    {/* KPI Cards */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card className="overflow-hidden relative border-none shadow-md bg-gradient-to-br from-blue-600 to-blue-700 text-white">
                            <CardContent className="p-6">
                                <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider mb-1">Saldo Calculado</p>
                                <div className="text-3xl font-bold tracking-tight">
                                    {formatCurrency(cashReport.closingBalance)}
                                </div>
                                <div className="mt-4 flex items-center text-blue-100 text-xs gap-2">
                                    <div className="bg-blue-500/30 px-2 py-1 rounded">
                                        Inicial: {formatCurrency(cashReport.openingBalance)}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden relative border-none shadow-md bg-white">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Ingresos</p>
                                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                        <RefreshCcw className="h-4 w-4 rotate-180" />
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {formatCurrency(cashReport.incomes)}
                                </div>
                                <p className="text-xs text-emerald-600 font-medium mt-1">
                                    + Ventas y Entradas
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden relative border-none shadow-md bg-white">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Egresos</p>
                                    <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                                        <RefreshCcw className="h-4 w-4" />
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {formatCurrency(cashReport.expenses)}
                                </div>
                                <p className="text-xs text-rose-600 font-medium mt-1">
                                    - Gastos y Retiros
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden relative border-none shadow-md bg-gray-50 border-dashed border-gray-200">
                            <CardContent className="p-6 flex flex-col justify-center h-full items-center text-center">
                                <p className="text-muted-foreground text-xs font-medium mb-2">Acción Requerida</p>
                                <Button size="sm" variant="outline" className="w-full bg-white hover:bg-gray-50" onClick={() => {
                                    if (!getCurrentRegister.isOpen) return
                                    onCloseRegister()
                                }}>
                                    Realizar Cierre Z
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Section */}
                    <div className="grid md:grid-cols-3 gap-6">
                        <Card className="md:col-span-3 border-none shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg font-medium text-gray-800">Análisis Financiero</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CashRegisterCharts
                                    cashReport={cashReport}
                                    precalculatedTotals={{
                                        cash: cashReport.cashSales || 0,
                                        card: cashReport.cardSales || 0,
                                        transfer: cashReport.transferSales || 0,
                                        mixed: cashReport.mixedSales || 0
                                    }}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-gray-50/50 rounded-xl border border-dashed">
                    <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <RefreshCcw className="h-6 w-6 opacity-20" />
                    </div>
                    <p className="font-medium">Selecciona un rango de fechas y genera el reporte</p>
                </div>
            )}
        </div>
    )
}
