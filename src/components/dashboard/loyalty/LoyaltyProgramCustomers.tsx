'use client'

import { useEffect, useState } from 'react'
import { Search, Users, CalendarCheck, Repeat2, Gift, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/currency'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import type { LoyaltySettingsRow } from '@/hooks/use-loyalty'

type ProgramData = {
  customers: Array<{
    id: string
    name: string
    balance: number
    visits: number
    last_visit: string | null
  }>
  total: number
  summary: { customers: number; visits: number; returningCustomers: number; redemptions: number }
}

export function LoyaltyProgramCustomers({ settings }: { settings: LoyaltySettingsRow | null }) {
  const { scope, currentScope, organizationId } = useTenantScope()
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [retry, setRetry] = useState(0)
  const [data, setData] = useState<ProgramData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          '/api/loyalty/program?q=' + encodeURIComponent(query.trim()) + '&offset=' + offset,
          {
            cache: 'no-store',
            signal: controller.signal,
            headers: organizationId ? { 'x-organization-id': organizationId } : undefined,
          }
        )
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'No se pudo cargar el progreso')
        if (!controller.signal.aborted && currentScope.current === scope) setData(body)
      } catch (reason) {
        if (!controller.signal.aborted && currentScope.current === scope)
          setError(reason instanceof Error ? reason.message : 'No se pudo cargar el progreso')
      } finally {
        if (!controller.signal.aborted && currentScope.current === scope) setLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, offset, retry, scope, currentScope, organizationId])
  const minimum = Number(settings?.min_redemption_points) || 0
  const value = Number(settings?.redemption_value) || 0
  const metrics = data
    ? [
        { label: 'Clientes con historial', value: data.summary.customers, icon: Users },
        { label: 'Turnos atendidos y cobrados', value: data.summary.visits, icon: CalendarCheck },
        { label: 'Clientes que volvieron', value: data.summary.returningCustomers, icon: Repeat2 },
        { label: 'Canjes por saldo a favor', value: data.summary.redemptions, icon: Gift },
      ]
    : []
  return (
    <section className="space-y-5" aria-label="Clientes y progreso">
      <div>
        <h3 className="text-lg font-semibold">Clientes y progreso</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Los turnos se registran desde la habilitación de esta función. Los puntos pueden incluir
          compras, promociones y ajustes.
        </p>
      </div>
      {loading ? (
        <div role="status" className="flex items-center gap-2 rounded-xl border p-5 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando datos de fidelización…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:bg-amber-950/20"
        >
          <p>{error}</p>
          <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      ) : (
        data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {metrics.map(({ label, value: count, icon: Icon }) => (
                <div key={label} className="rounded-2xl border bg-card p-4">
                  <Icon aria-hidden="true" className="mb-3 h-4 w-4 text-primary" />
                  <p className="text-2xl font-semibold tabular-nums">
                    {Number(count).toLocaleString('es-PY')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Totales de toda la organización, sin filtro por nombre. Los canjes no equivalen al uso
              posterior del saldo a favor.
            </p>
          </>
        )
      )}
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
        />
        <Input
          aria-label="Buscar cliente por nombre"
          placeholder="Buscar cliente por nombre"
          maxLength={100}
          className="h-10 pl-9"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOffset(0)
          }}
        />
      </div>
      {!loading && !error && data && (
        <>
          {!data.customers.length ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <Users aria-hidden="true" className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
              <p className="font-medium">
                {query ? 'No encontramos ese cliente' : 'Todavía no hay historial de fidelización'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Asociá un cliente al cobrar. No se crean visitas a partir de reservas pendientes.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.customers.map((customer) => {
                const balance = Number(customer.balance)
                const remaining = Math.max(0, minimum - balance)
                const progress =
                  minimum > 0 ? Math.min(100, Math.max(0, (balance / minimum) * 100)) : 0
                return (
                  <article
                    key={customer.id}
                    className="min-w-0 space-y-4 rounded-2xl border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="break-words font-semibold">{customer.name}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {Number(customer.visits)} turnos atendidos y cobrados
                        </p>
                      </div>
                      <p className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
                        {balance.toLocaleString('es-PY')} pts
                      </p>
                    </div>
                    {value > 0 ? (
                      <div className="space-y-2">
                        {minimum > 0 && (
                          <div
                            role="progressbar"
                            aria-label={
                              'Progreso de ' + customer.name + ' hacia el mínimo de canje'
                            }
                            aria-valuenow={Math.round(progress)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="h-2 overflow-hidden rounded-full bg-muted"
                          >
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: progress + '%' }}
                            />
                          </div>
                        )}
                        <p className="text-sm">
                          {balance <= 0
                            ? 'Todavía no tiene puntos para canjear.'
                            : remaining > 0
                              ? 'Le faltan ' +
                                remaining +
                                ' puntos para alcanzar el mínimo de canje.'
                              : (settings?.enabled ? 'Puede canjear ' : 'Al reactivar, puede canjear ') +
                                formatCurrency(balance * value) +
                                ' de saldo a favor.'}
                        </p>
                        {!settings?.enabled && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Programa pausado: el saldo se conserva; el canje requiere reactivarlo.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        El canje por saldo a favor no está habilitado.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {customer.last_visit
                        ? 'Último turno registrado: ' +
                          new Date(customer.last_visit).toLocaleDateString('es-PY')
                        : 'Sin turnos registrados en este programa'}
                    </p>
                  </article>
                )
              })}
            </div>
          )}
          {data.total > 25 && (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset((n) => Math.max(0, n - 25))}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                {offset + 1}–{Math.min(offset + 25, data.total)} de {data.total}
              </span>
              <Button
                variant="outline"
                disabled={offset + 25 >= data.total}
                onClick={() => setOffset((n) => n + 25)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
