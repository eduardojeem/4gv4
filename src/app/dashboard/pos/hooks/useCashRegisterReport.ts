import { useState, useCallback } from 'react'
import { useCashRegisterContext } from '../contexts/CashRegisterContext'
import { formatCurrency } from '@/lib/currency'

interface UseCashRegisterReportReturn {
    reportStart: string
    setReportStart: (date: string) => void
    reportEnd: string
    setReportEnd: (date: string) => void
    generateReport: () => Promise<void>
    exportReportCSV: () => void
    isGenerating: boolean
}

export function useCashRegisterReport(): UseCashRegisterReportReturn {
    const { cashReport, generateCashReportForRange } = useCashRegisterContext()
    const [reportStart, setReportStart] = useState('')
    const [reportEnd, setReportEnd] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)

    const generateReport = useCallback(async () => {
        setIsGenerating(true)
        try {
            await generateCashReportForRange(reportStart, reportEnd)
        } finally {
            setIsGenerating(false)
        }
    }, [generateCashReportForRange, reportStart, reportEnd])

    const exportReportCSV = useCallback(() => {
        if (!cashReport) return

        const headers = ['Inicio Periodo', 'Fin Periodo', 'Saldo Inicial', 'Ingresos', 'Egresos', 'Saldo Final', 'Ventas Efectivo', 'Ventas Tarjeta', 'Ventas Transferencia']
        const values = [
            cashReport.periodStart,
            cashReport.periodEnd,
            cashReport.openingBalance,
            cashReport.incomes,
            cashReport.expenses,
            cashReport.closingBalance,
            cashReport.cashSales || 0,
            cashReport.cardSales || 0,
            cashReport.transferSales || 0
        ]

        const row = values.map(v => {
            if (typeof v === 'number') return v.toString()
            return JSON.stringify(v ?? '')
        }).join(',')

        const csv = headers.join(',') + '\n' + row
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reporte_caja_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }, [cashReport])

    return {
        reportStart,
        setReportStart,
        reportEnd,
        setReportEnd,
        generateReport,
        exportReportCSV,
        isGenerating
    }
}
