'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useCashRegisterContext, ZClosureRecord } from '../../contexts/CashRegisterContext'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertTriangle, ArrowLeft, Download, History, RefreshCw, Search, Shield } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useAuth } from '@/contexts/auth-context'

function byClosedAtDesc(a: ZClosureRecord, b: ZClosureRecord) {
  return new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
}

export default function CashRegisterHistoryPage() {
  const { user } = useAuth()
  const { zClosureHistory, fetchZClosureHistory, checkPermission } = useCashRegisterContext()
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<'all' | 'week' | 'month' | 'year'>('all')
  const [status, setStatus] = useState<'all' | 'perfect' | 'with_diff'>('all')

  const canAccess = user?.role === 'admin' || checkPermission('canViewReports')
  const canExport = checkPermission('canExportData')

  const loadHistory = async () => {
    setLoading(true)
    try {
      await fetchZClosureHistory()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canAccess) {
      loadHistory()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = new Date()
    let cutoff: Date | null = null
    if (period === 'week') {
      cutoff = new Date(now)
      cutoff.setDate(now.getDate() - 7)
    } else if (period === 'month') {
      cutoff = new Date(now)
      cutoff.setMonth(now.getMonth() - 1)
    } else if (period === 'year') {
      cutoff = new Date(now)
      cutoff.setFullYear(now.getFullYear() - 1)
    }

    return [...zClosureHistory]
      .filter((c) => {
        if (cutoff && new Date(c.closedAt) < cutoff) return false
        if (status === 'perfect' && Math.abs(c.discrepancy) >= 1) return false
        if (status === 'with_diff' && Math.abs(c.discrepancy) < 1) return false
        if (!q) return true
        const haystack = `${c.registerId} ${c.closedBy} ${c.notes || ''} ${new Date(c.date).toLocaleDateString('es-PY')}`.toLowerCase()
        return haystack.includes(q)
      })
      .sort(byClosedAtDesc)
  }, [zClosureHistory, search, period, status])

  const summary = useMemo(() => {
    const total = filtered.length
    const perfect = filtered.filter((c) => Math.abs(c.discrepancy) < 1).length
    const withDiff = total - perfect
    const sales = filtered.reduce((s, c) => s + c.totalSales, 0)
    const diffAmount = filtered.reduce((s, c) => s + Math.abs(c.discrepancy), 0)
    return { total, perfect, withDiff, sales, diffAmount }
  }, [filtered])

  const exportCsv = () => {
    if (!canExport) return

    const headers = [
      'Fecha',
      'Hora',
      'Caja',
      'Cerrado por',
      'Saldo inicial',
      'Saldo final',
      'Saldo esperado',
      'Discrepancia',
      'Ventas',
      'Ingresos',
      'Egresos',
      'Movimientos',
      'Notas'
    ]
    const rows = filtered.map((c) => [
      new Date(c.closedAt).toLocaleDateString('es-PY'),
      new Date(c.closedAt).toLocaleTimeString('es-PY'),
      c.registerId,
      c.closedBy || '',
      c.openingBalance,
      c.closingBalance,
      c.expectedBalance,
      c.discrepancy,
      c.totalSales,
      c.totalCashIn,
      c.totalCashOut,
      c.movementsCount,
      c.notes || ''
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `historial_cierres_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!canAccess) {
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto border rounded-xl p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold mb-2">Acceso denegado</h1>
          <p className="text-sm text-muted-foreground mb-4">No tienes permisos para acceder al historial de cierres.</p>
          <Link href="/dashboard/pos/caja">
            <Button variant="outline">Volver a Caja</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href="/dashboard/pos/caja">
              <Button variant="outline" size="icon" aria-label="Volver a Caja">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historial de Cierres
            </h1>
            <Badge variant="outline">{summary.total} cierres</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/pos/caja/auditoria">
              <Button variant="outline" size="sm">
                <Shield className="h-4 w-4 mr-2" />
                Ir a Auditoria
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={loadHistory} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            {canExport && (
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-2">
          <div className="rounded-lg border px-3 py-2 bg-background">
            <p className="text-[11px] text-muted-foreground">Sin diferencia</p>
            <p className="text-sm font-semibold text-emerald-700">{summary.perfect}</p>
          </div>
          <div className="rounded-lg border px-3 py-2 bg-background">
            <p className="text-[11px] text-muted-foreground">Con diferencia</p>
            <p className="text-sm font-semibold text-amber-700">{summary.withDiff}</p>
          </div>
          <div className="rounded-lg border px-3 py-2 bg-background">
            <p className="text-[11px] text-muted-foreground">Ventas acumuladas</p>
            <p className="text-sm font-semibold">{formatCurrency(summary.sales)}</p>
          </div>
          <div className="rounded-lg border px-3 py-2 bg-background xl:col-span-2">
            <p className="text-[11px] text-muted-foreground">Diferencia acumulada</p>
            <p className="text-sm font-semibold text-rose-700">{formatCurrency(summary.diffAmount)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por caja, usuario, nota, fecha" className="pl-9" />
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger><SelectValue placeholder="Periodo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo</SelectItem>
              <SelectItem value="week">Ultima semana</SelectItem>
              <SelectItem value="month">Ultimo mes</SelectItem>
              <SelectItem value="year">Ultimo ano</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="perfect">Sin diferencia</SelectItem>
              <SelectItem value="with_diff">Con diferencia</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="hidden lg:grid grid-cols-[150px_90px_110px_1fr_120px_120px_120px_120px] gap-3 px-4 py-3 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div>Fecha</div>
          <div>Hora</div>
          <div>Caja</div>
          <div>Cerrado por</div>
          <div className="text-right">Ventas</div>
          <div className="text-right">Saldo final</div>
          <div className="text-right">Esperado</div>
          <div className="text-right">Diferencia</div>
        </div>

        <ScrollArea className="h-[calc(100vh-330px)] min-h-[420px]">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No hay cierres para los filtros seleccionados.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((closure) => {
                const diff = closure.discrepancy
                return (
                  <div key={closure.id} className="px-4 py-3 hover:bg-muted/40">
                    <div className="grid lg:grid-cols-[150px_90px_110px_1fr_120px_120px_120px_120px] gap-3 items-start text-sm">
                      <div>{new Date(closure.closedAt).toLocaleDateString('es-PY')}</div>
                      <div>{new Date(closure.closedAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</div>
                      <div>{closure.registerId}</div>
                      <div className="truncate" title={closure.closedBy}>{closure.closedBy || 'Usuario no identificado'}</div>
                      <div className="text-right font-mono">{formatCurrency(closure.totalSales)}</div>
                      <div className="text-right font-mono">{formatCurrency(closure.closingBalance)}</div>
                      <div className="text-right font-mono">{formatCurrency(closure.expectedBalance)}</div>
                      <div className={`text-right font-mono font-semibold ${diff === 0 ? 'text-emerald-700' : diff > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                        {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}

