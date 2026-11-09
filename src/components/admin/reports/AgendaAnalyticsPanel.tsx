'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarCheck, CalendarClock, CalendarX2, Globe, Repeat, Wallet } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { AgendaAnalytics, AgendaInsight, AgendaRankingRow } from '@/lib/analytics/agenda-analytics'
import { AnalyticsLoadingState, EmptyState, InsightItem, MetricCard, MiniStat } from './analytics-widgets'

type AgendaResponse = {
  data: AgendaAnalytics | null
  insights?: AgendaInsight[]
  available: boolean
  error?: string
}

const percent = (value: number | null) => (value === null ? '--' : `${value.toFixed(0)}%`)

function Panel({ title, description, className, children }: { title: string; description?: string; className?: string; children: ReactNode }) {
  return (
    <Card className={cn('min-w-0 gap-0 border border-gray-200 py-0 shadow-sm dark:border-slate-800', className)}>
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="px-5 pb-5">{children}</CardContent>
    </Card>
  )
}

function Ranking({ rows, nameLabel, empty }: { rows: AgendaRankingRow[]; nameLabel: string; empty: string }) {
  if (!rows.length) return <EmptyState title="Sin turnos en el período" description={empty} />
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{nameLabel}</TableHead>
            <TableHead className="text-right">Turnos</TableHead>
            <TableHead className="text-right">Atendidos</TableHead>
            <TableHead className="hidden text-right sm:table-cell">No vino</TableHead>
            <TableHead className="text-right">Facturado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 10).map((row) => (
            <TableRow key={row.key}>
              <TableCell className="max-w-[220px] truncate font-medium text-foreground">{row.name}</TableCell>
              <TableCell className="text-right tabular-nums">{row.booked}</TableCell>
              <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
              <TableCell className={cn('hidden text-right tabular-nums sm:table-cell', row.noShow > 0 && 'text-amber-600 dark:text-amber-400')}>{row.noShow}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(row.revenue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Pestaña «Agenda» de Analytics: para barberías, salones, estética y cualquier
 * negocio que trabaja con turnos (módulo Servicios).
 */
export function AgendaAnalyticsPanel({ from, to, refreshKey = 0 }: { from: Date; to: Date; refreshKey?: number }) {
  const [state, setState] = useState<{ loading: boolean; response: AgendaResponse | null; error: string | null }>({ loading: true, response: null, error: null })
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/admin/analytics/agenda?${new URLSearchParams({ from: fromIso, to: toIso })}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as AgendaResponse | null
        if (!response.ok || !body) throw new Error(body?.error || 'No se pudieron cargar los números de la agenda.')
        setState({ loading: false, response: body, error: null })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ loading: false, response: null, error: error instanceof Error ? error.message : 'Error' })
      })
    return () => controller.abort()
  }, [fromIso, toIso, refreshKey])

  if (state.loading && !state.response) return <AnalyticsLoadingState />
  if (state.error) return <EmptyState title="No se pudo cargar la agenda" description={state.error} />
  const data = state.response?.data
  if (!state.response?.available || !data) {
    return <EmptyState title="La agenda todavía no está lista" description="Cuando la agenda esté configurada, acá vas a ver turnos, asistencia y lo que facturaste por servicios." />
  }

  if (data.booked + data.cancelled === 0) {
    return (
      <Card className="border border-dashed border-gray-300 py-0 shadow-none dark:border-slate-700">
        <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <CalendarClock className="h-8 w-8 text-muted-foreground" />
          <p className="text-base font-semibold text-foreground">No hay turnos en este período</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {data.nextSevenDays > 0
              ? `Tenés ${data.nextSevenDays} ${data.nextSevenDays === 1 ? 'turno' : 'turnos'} en los próximos 7 días. Probá con otro rango de fechas.`
              : 'Cargá los turnos en la agenda o compartí el link de reservas para que los clientes reserven solos.'}
          </p>
          <Button asChild variant="outline" size="sm"><Link href="/dashboard/agenda">Ir a la agenda</Link></Button>
        </CardContent>
      </Card>
    )
  }

  const insights = state.response.insights ?? []

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Turnos atendidos" value={String(data.completed)} helper={`De ${data.booked} turnos reservados`} delta={null} tone="success" icon={CalendarCheck} />
        <MetricCard title="Facturado por turnos" value={formatCurrency(data.revenue)} helper={data.averageTicket !== null ? `Promedio ${formatCurrency(data.averageTicket)} por turno` : 'Sin turnos atendidos'} delta={null} tone="info" icon={Wallet} />
        <MetricCard title="Asistencia" value={percent(data.attendanceRate)} helper={`${data.noShow} ${data.noShow === 1 ? 'cliente no vino' : 'clientes no vinieron'}`} delta={null} tone={data.attendanceRate !== null && data.attendanceRate < 85 ? 'warning' : 'success'} icon={CalendarX2} />
        <MetricCard title="Reservas online" value={percent(data.onlineShare)} helper={`${data.online} reservadas desde la página`} delta={null} tone="info" icon={Globe} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Próximos en el período" value={String(data.upcoming)} tone="info" />
        <MiniStat label="Próximos 7 días" value={String(data.nextSevenDays)} tone="info" hint="Desde hoy, pendientes o confirmados" />
        <MiniStat label="Sin cerrar" value={String(data.unclosed)} tone={data.unclosed > 0 ? 'warning' : 'success'} hint="Ya pasaron y nadie marcó si vino" />
        <MiniStat label="Cancelados" value={String(data.cancelled)} tone={data.cancelled > 0 ? 'warning' : 'neutral'} hint={percent(data.cancellationRate)} />
        <MiniStat label="Horas reservadas" value={`${data.bookedHours} h`} tone="neutral" />
        <MiniStat label="Perdido por inasistencias" value={formatCurrency(data.noShowValue)} tone={data.noShowValue > 0 ? 'warning' : 'neutral'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Turnos por día" description="Atendidos, no vino, cancelados y por atender, en la hora de tu negocio.">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily.map((day) => ({ ...day, label: day.date.slice(8, 10) + '/' + day.date.slice(5, 7) }))}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="completed" stackId="d" fill="#0f766e" name="Atendidos" />
                <Bar dataKey="open" stackId="d" fill="#2563eb" name="Por atender / sin cerrar" />
                <Bar dataKey="noShow" stackId="d" fill="#d97706" name="No vino" />
                <Bar dataKey="cancelled" stackId="d" fill="#94a3b8" name="Cancelados" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Lo que tenés que mirar" description="Avisos sobre tu agenda en este período.">
          {insights.length ? (
            <div className="space-y-3">
              {insights.map((insight) => (
                <InsightItem key={insight.id} title={insight.title} description={insight.description} context="Agenda" tone={insight.tone} />
              ))}
            </div>
          ) : (
            <EmptyState title="Todo en orden" description="La agenda viene bien en este período." />
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Días con más turnos" description="Para planificar personal y promociones.">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byWeekday}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                <Bar dataKey="count" fill="#2563eb" name="Turnos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Horarios más pedidos" description="Hora de inicio de los turnos.">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byHour}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                <Bar dataKey="count" fill="#7c3aed" name="Turnos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Servicios más pedidos" description="Ordenados por cantidad de turnos.">
          <Ranking rows={data.services} nameLabel="Servicio" empty="Todavía no hay servicios reservados." />
        </Panel>
        <Panel title="Por profesional" description="Turnos, asistencia y lo facturado por cada uno.">
          <Ranking rows={data.professionals} nameLabel="Profesional" empty="Todavía no hay turnos asignados." />
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Clientes atendidos" value={String(data.customers.unique)} tone="info" />
        <MiniStat label="Clientes nuevos" value={String(data.customers.new)} tone="success" hint="Su primer turno fue en este período" />
        <MiniStat label="Clientes que volvieron" value={String(data.customers.returning)} tone="success" />
        <MiniStat label="Cobrado en caja" value={formatCurrency(data.chargedRevenue)} tone="neutral" hint="Turnos atendidos que ya pasaron por el POS" />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Repeat className="h-3.5 w-3.5" />
        Un cliente se reconoce por su ficha, su teléfono o su nombre, aunque el turno se haya cargado sin ficha.
      </p>
    </div>
  )
}
