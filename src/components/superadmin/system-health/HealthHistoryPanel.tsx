'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { History, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { readHealthHistoryAction } from '@/app/superadmin/system-health/actions'
import { summarizeHistoryRuns } from '@/lib/health/history'
import { HEALTH_STATUSES, type HealthHistoryResult } from '@/lib/health/types'
import { SeverityBadge, StatusBadge } from './CheckDetailSheet'
import { CATEGORY_LABEL, CATEGORY_ORDER, STATUS_META, formatDateTime } from './health-meta'

const ALL = 'all'

export function HealthHistoryPanel({ initial }: { initial: HealthHistoryResult }) {
  const [history, setHistory] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [pending, startTransition] = useTransition()
  const runs = useMemo(() => summarizeHistoryRuns(history.entries), [history.entries])

  const search = useCallback(() => {
    startTransition(async () => {
      const result = await readHealthHistoryAction({
        category: category === ALL ? undefined : category,
        status: status === ALL ? undefined : status,
        from: from || undefined,
        to: to || undefined,
        limit: 300,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        setHistory(result.data)
        setError(null)
      }
    })
  }, [category, status, from, to])

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" aria-hidden /> Historial de diagnósticos
        </CardTitle>
        <CardDescription>Cada ejecución guarda el resultado de todas las comprobaciones.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="history-from">Desde</Label>
            <Input id="history-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="history-to">Hasta</Label>
            <Input id="history-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Categoría"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {CATEGORY_ORDER.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Estado"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {HEALTH_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={search} disabled={pending} className="w-full">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Filtrar
            </Button>
          </div>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

        {!history.available ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">{history.reason}</p>
        ) : history.entries.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
            No hay registros para estos filtros. Ejecutá un diagnóstico para generar historial.
          </p>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const entries = history.entries.filter((entry) => entry.runId === run.runId)
              return (
                <details key={run.runId} className="group rounded-lg border dark:border-slate-800">
                  <summary className="cursor-pointer list-none p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">Ejecución {run.runId}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(run.finishedAt)} · {run.checkCount} comprobaciones · {run.durationMs} ms acumulados
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {run.counts.error > 0 && <span>{run.counts.error} error(es)</span>}
                        {run.counts.warning > 0 && <span>{run.counts.warning} advertencia(s)</span>}
                        {run.counts.unknown > 0 && <span>{run.counts.unknown} no verificable(s)</span>}
                        <span>{run.counts.healthy} correcto(s)</span>
                      </div>
                    </div>
                  </summary>
                  <ul className="divide-y border-t dark:divide-slate-800 dark:border-slate-800">
                    {entries.map((entry) => (
                      <li key={entry.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {CATEGORY_LABEL[entry.category] ?? entry.category} · <span className="font-normal">{entry.checkId}</span>
                          </p>
                          <p className="break-words text-sm text-slate-600 dark:text-slate-300">{entry.message}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {entry.status !== 'healthy' && <SeverityBadge severity={entry.severity} />}
                          <StatusBadge status={entry.status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
