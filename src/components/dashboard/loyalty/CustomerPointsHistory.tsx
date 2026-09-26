'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Coins, Gift, Loader2, ShieldAlert, ShieldCheck, Ticket, Trophy } from 'lucide-react'
import { toast } from 'sonner'

export interface LedgerEntry {
  id: string
  points: number
  balance_after: number
  source: 'purchase' | 'promotion' | 'raffle_entry' | 'raffle_refund' | 'adjustment' | 'expiration'
  description: string
  created_at: string
}

export interface TicketEntry {
  id: string
  ticket_number: number
  points_spent: number
  created_at: string
  raffle?: { id: string; name: string; status: string; ends_at: string; drawn_at: string | null } | null
}

export interface WinnerEntry {
  id: string
  prize_position: number
  prize_title: string
  claim_status: 'pending' | 'validated' | 'delivered' | 'forfeited'
  raffle?: { id: string; name: string; drawn_at: string | null } | null
}

const SOURCE_LABEL: Record<LedgerEntry['source'], string> = {
  purchase: 'Compra',
  promotion: 'Promoción',
  raffle_entry: 'Canje por sorteo',
  raffle_refund: 'Devolución',
  adjustment: 'Ajuste manual',
  expiration: 'Vencimiento',
}

const CLAIM_LABEL: Record<WinnerEntry['claim_status'], string> = {
  pending: 'Por validar',
  validated: 'Validado',
  delivered: 'Entregado',
  forfeited: 'No reclamado',
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Historial de puntos de un cliente: saldo, cada movimiento, sus números y los
 * premios que ganó.
 *
 * El saldo que se muestra es el que trae la base, no una suma hecha acá: si el
 * navegador pudiera calcularlo, cualquiera podría mostrar el número que quiera.
 */
export function CustomerPointsHistory({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(true)
  const [moduleInstalled, setModuleInstalled] = useState(true)
  const [balance, setBalance] = useState(0)
  const [lifetimeEarned, setLifetimeEarned] = useState(0)
  const [lifetimeRedeemed, setLifetimeRedeemed] = useState(0)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [tickets, setTickets] = useState<TicketEntry[]>([])
  const [winners, setWinners] = useState<WinnerEntry[]>([])
  const [excludedUntil, setExcludedUntil] = useState<string | null>(null)
  const [savingExclusion, setSavingExclusion] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/loyalty/customers/${customerId}`, { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))

      if (body?.moduleInstalled === false) {
        setModuleInstalled(false)
        return
      }

      setModuleInstalled(true)
      setBalance(body?.account?.balance ?? 0)
      setLifetimeEarned(body?.account?.lifetime_earned ?? 0)
      setLifetimeRedeemed(body?.account?.lifetime_redeemed ?? 0)
      setExcludedUntil(body?.account?.self_excluded_until ?? null)
      setLedger(body?.ledger ?? [])
      setTickets(body?.tickets ?? [])
      setWinners(body?.winners ?? [])
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    void load()
  }, [load])

  // Un año es el plazo habitual de una autoexclusión a pedido.
  const toggleExclusion = async () => {
    const isExcluded = excludedUntil != null && new Date(excludedUntil) > new Date()
    const until = isExcluded ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

    setSavingExclusion(true)
    try {
      const response = await fetch(`/api/loyalty/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ self_excluded_until: until }),
      })
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(body?.error ?? 'No se pudo actualizar la autoexclusión')
        return
      }

      setExcludedUntil(body?.account?.self_excluded_until ?? null)
      toast.success(isExcluded ? 'Autoexclusión levantada' : 'Autoexclusión registrada por un año')
    } finally {
      setSavingExclusion(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando historial de puntos...
      </div>
    )
  }

  if (!moduleInstalled) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-xs text-slate-500">
        El módulo de puntos todavía no está instalado.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-amber-50/50 p-3 dark:bg-amber-950/20">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Saldo</p>
          <p className="mt-0.5 text-xl font-bold text-amber-900 dark:text-amber-200">{balance}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Acumulados</p>
          <p className="mt-0.5 text-xl font-bold text-slate-700 dark:text-slate-200">{lifetimeEarned}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Canjeados</p>
          <p className="mt-0.5 text-xl font-bold text-slate-700 dark:text-slate-200">{lifetimeRedeemed}</p>
        </div>
      </div>

      {/* Juego responsable: la exclusión bloquea participar en sorteos, pero
          el cliente sigue acumulando puntos por sus compras. */}
      {excludedUntil && new Date(excludedUntil) > new Date() ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200/60 bg-rose-50/50 px-3.5 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
          <p className="flex items-start gap-2 text-xs text-rose-900 dark:text-rose-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Autoexcluido de sorteos hasta el {new Date(excludedUntil).toLocaleDateString('es-PY')}. Sigue
              acumulando puntos por sus compras.
            </span>
          </p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={toggleExclusion} disabled={savingExclusion}>
            {savingExclusion && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            Levantar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-3.5 py-2.5">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Puede participar en sorteos.
          </p>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={toggleExclusion} disabled={savingExclusion}>
            {savingExclusion && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            Registrar autoexclusión
          </Button>
        </div>
      )}

      <Tabs defaultValue="movimientos">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="movimientos" className="text-xs">Movimientos</TabsTrigger>
          <TabsTrigger value="numeros" className="text-xs">Números ({tickets.length})</TabsTrigger>
          <TabsTrigger value="premios" className="text-xs">Premios ({winners.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="movimientos" className="mt-3 space-y-2">
          {ledger.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">Todavía no hay movimientos de puntos.</p>
          ) : (
            ledger.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{SOURCE_LABEL[entry.source]}</Badge>
                    <span className="text-xs text-slate-500">{formatDate(entry.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{entry.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-bold ${
                      entry.points >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {entry.points >= 0 ? '+' : ''}{entry.points}
                  </p>
                  <p className="text-[10px] text-slate-400">saldo: {entry.balance_after}</p>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="numeros" className="mt-3 space-y-2">
          {tickets.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">No participó en ningún sorteo.</p>
          ) : (
            tickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div className="flex items-center gap-2.5">
                  <Ticket className="h-4 w-4 shrink-0 text-indigo-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {ticket.raffle?.name ?? 'Sorteo'}
                    </p>
                    <p className="text-[11px] text-slate-500">{formatDate(ticket.created_at)}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                    Nº {ticket.ticket_number}
                  </p>
                  <p className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
                    <Coins className="h-2.5 w-2.5" />
                    {ticket.points_spent} pts
                  </p>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="premios" className="mt-3 space-y-2">
          {winners.length === 0 ? (
            <p className="flex flex-col items-center gap-2 py-6 text-center text-xs text-slate-500">
              <Gift className="h-5 w-5 text-slate-300" />
              Todavía no ganó ningún premio.
            </p>
          ) : (
            winners.map((winner) => (
              <div key={winner.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/60 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <div className="flex items-center gap-2.5">
                  <Trophy className="h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{winner.prize_title}</p>
                    <p className="text-[11px] text-slate-500">
                      {winner.prize_position}º premio · {winner.raffle?.name ?? 'Sorteo'}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {CLAIM_LABEL[winner.claim_status]}
                </Badge>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
