import { useState, useCallback } from 'react'
import { useCashRegisterContext } from '../contexts/CashRegisterContext'
import { formatCurrency } from '@/lib/currency'

interface UseCashRegisterReportReturn {
    reportStart: string
    setReportStart: (date: string) => void
    reportEnd: string
    setReportEnd: (date: string) => void
    setPresetRange: (preset: 'today' | 'week' | 'month') => void
    generateReport: () => Promise<void>
    exportReportCSV: () => void
    isGenerating: boolean
}

function toDateTimeLocalInput(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = date.getFullYear()
    const m = pad(date.getMonth() + 1)
    const d = pad(date.getDate())
    const h = pad(date.getHours())
    const min = pad(date.getMinutes())
    return `${y}-${m}-${d}T${h}:${min}`
}

function getTodayRange() {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return { start, end }
}

export function useCashRegisterReport(): UseCashRegisterReportReturn {
    const { cashReport, generateCashReportForRange } = useCashRegisterContext()
    const initialRange = getTodayRange()
    const [reportStart, setReportStart] = useState(toDateTimeLocalInput(initialRange.start))
    const [reportEnd, setReportEnd] = useState(toDateTimeLocalInput(initialRange.end))
    const [isGenerating, setIsGenerating] = useState(false)

    const setPresetRange = useCallback((preset: 'today' | 'week' | 'month') => {
        const end = new Date()
        let start = new Date()

        if (preset === 'today') {
            start.setHours(0, 0, 0, 0)
            end.setHours(23, 59, 59, 999)
        } else if (preset === 'week') {
            const day = start.getDay()
            const diff = (day + 6) % 7 // Monday as start
            start.setDate(start.getDate() - diff)
            start.setHours(0, 0, 0, 0)
            end.setHours(23, 59, 59, 999)
        } else {
            start = new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0, 0)
            end.setHours(23, 59, 59, 999)
        }

        setReportStart(toDateTimeLocalInput(start))
        setReportEnd(toDateTimeLocalInput(end))
    }, [])

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
        setPresetRange,
        generateReport,
        exportReportCSV,
        isGenerating
    }
}

