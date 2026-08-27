'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Coins, Loader2, Search, ShieldAlert, Ticket, User } from 'lucide-react'
import {
  checkParticipation,
  maxTicketsAllowed,
  responsiblePlayNotice,
  type ParticipantAccount,
  type RaffleForParticipation,
} from '@/lib/raffles/responsible-play'
import { winningOdds } from '@/lib/raffles/draw'
import type { RaffleRow } from '@/hooks/use-loyalty'

interface RaffleRedeemDialogProps {
  raffle: RaffleRow | null
  onOpenChange: (open: boolean) => void
  onRedeemed: () => void
}

interface CustomerOption {
  id: string
  name: string
  phone?: string | null
  email?: string | null
}

interface CustomerLoyaltyState {
  account: ParticipantAccount
  ticketsInThisRaffle: number
}

/** El sorteo tal como lo espera la validación de juego responsable. */
function toParticipationRaffle(raffle: RaffleRow): RaffleForParticipation {
  return {
    id: raffle.id,
    name: raffle.name,
    status: raffle.status,
    startsAt: raffle.starts_at,
    endsAt: raffle.ends_at,
    pointsPerTicket: raffle.points_per_ticket,
    maxTicketsPerCustomer: raffle.max_tickets_per_customer,
    maxTicketsTotal: raffle.max_tickets_total,
    minAge: raffle.min_age,
  }
}

/**
 * Canje de puntos por números de sorteo.
 *
 * La validación se corre acá para poder explicar el motivo antes de intentar,
 * pero no es la que manda: la función de la base vuelve a evaluar estado,
 * autoexclusión, topes y saldo dentro de la misma transacción que asigna los
 * números. Si esta pantalla se equivoca, la base rechaza igual.
 */
export function RaffleRedeemDialog({ raffle, onOpenChange, onRedeemed }: RaffleRedeemDialogProps) {
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<CustomerOption | null>(null)
  const [state, setState] = useState<CustomerLoyaltyState | null>(null)
  const [loadingState, setLoadingState] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [redeeming, setRedeeming] = useState(false)
  const [issued, setIssued] = useState<number[] | null>(null)

  const ticketsIssuedTotal = raffle?.tickets?.[0]?.count ?? 0

  // Se limpia todo al abrir con otro sorteo: dejar el cliente anterior
  // seleccionado invitaría a canjear en el sorteo equivocado.
  useEffect(() => {
    setSearch('')
    setCustomers([])
    setSelected(null)
    setState(null)
    setQuantity(1)
    setIssued(null)
  }, [raffle?.id])

  const runSearch = useCallback(async () => {
    const term = search.trim()
    if (term.length < 2) {
      toast.error('Escribí al menos 2 letras para buscar')
      return
    }

    setSearching(true)
    try {
      const response = await fetch(`/api/customers?search=${encodeURIComponent(term)}&limit=8`, {
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      setCustomers(body?.data ?? [])
      if ((body?.data ?? []).length === 0) toast.info('Ningún cliente coincide con la búsqueda')
    } finally {
      setSearching(false)
    }
  }, [search])

  const loadCustomerState = useCallback(async (customer: CustomerOption) => {
    if (!raffle) return

    setLoadingState(true)
    try {
      const response = await fetch(`/api/loyalty/customers/${customer.id}`, { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))

      const tickets: Array<{ raffle?: { id?: string } | null }> = body?.tickets ?? []

      setState({
        account: {
          balance: body?.account?.balance ?? 0,
          selfExcludedUntil: body?.account?.self_excluded_until ?? null,
        },
        ticketsInThisRaffle: tickets.filter((t) => t.raffle?.id === raffle.id).length,
      })
    } finally {
      setLoadingState(false)
    }
  }, [raffle])

  // Elegir otro cliente sí limpia el resultado anterior; recargar el saldo
  // después de canjear, no: son los números que el cajero acaba de dictar.
  const pickCustomer = useCallback(async (customer: CustomerOption) => {
    setSelected(customer)
    setIssued(null)
    await loadCustomerState(customer)
  }, [loadCustomerState])

  if (!raffle) return null

  const participation = state
    ? checkParticipation({
        raffle: toParticipationRaffle(raffle),
        account: state.account,
        quantity,
        ticketsAlreadyOwned: state.ticketsInThisRaffle,
        ticketsIssuedTotal,
      })
    : null

  const maxNow = state
    ? maxTicketsAllowed({
        raffle: toParticipationRaffle(raffle),
        account: state.account,
        ticketsAlreadyOwned: state.ticketsInThisRaffle,
        ticketsIssuedTotal,
      })
    : 0

  const odds = state
    ? winningOdds(state.ticketsInThisRaffle + quantity, ticketsIssuedTotal + quantity)
    : 0

  const handleRedeem = async () => {
    if (!selected || !participation?.allowed) return

    setRedeeming(true)
    try {
      const response = await fetch(`/api/raffles/${raffle.id}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: selected.id, quantity }),
      })
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(body?.error ?? 'No se pudo canjear')
        return
      }

      const numbers = (body?.tickets ?? []).map((t: { ticket_number: number }) => t.ticket_number)
      setIssued(numbers)
      toast.success(`${numbers.length} número(s) asignados`)
      onRedeemed()
      // Se recarga el saldo, que quedó más bajo, sin borrar los números.
      await loadCustomerState(selected)
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <Dialog open={!!raffle} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Canjear puntos por números</DialogTitle>
          <DialogDescription className="text-xs">
            {raffle.name} · {raffle.points_per_ticket} puntos por número
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Cliente ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="redeem-search" className="text-xs">Cliente</Label>
            <div className="flex gap-2">
              <Input
                id="redeem-search"
                placeholder="Nombre, teléfono o correo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void runSearch()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={runSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {customers.length > 0 && !selected && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border p-1">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => pickCustomer(customer)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="font-medium">{customer.name}</span>
                    {customer.phone && <span className="text-slate-400">· {customer.phone}</span>}
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selected.name}</p>
                  {loadingState ? (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> Cargando saldo...
                    </p>
                  ) : (
                    <p className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Coins className="h-3 w-3" />
                        {state?.account.balance ?? 0} puntos
                      </span>
                      <span className="flex items-center gap-1">
                        <Ticket className="h-3 w-3" />
                        {state?.ticketsInThisRaffle ?? 0} número(s) en este sorteo
                      </span>
                    </p>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs" onClick={() => { setSelected(null); setState(null) }}>
                  Cambiar
                </Button>
              </div>
            )}
          </div>

          {/* ── Cantidad ────────────────────────────────────────────── */}
          {state && !loadingState && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="redeem-qty" className="text-xs">Cuántos números</Label>
                  <span className="text-[11px] text-slate-500">
                    puede llevar hasta {maxNow}
                  </span>
                </div>
                <Input
                  id="redeem-qty"
                  type="number"
                  min={1}
                  max={Math.max(1, maxNow)}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>

              {/* La chance se muestra tal cual es, sin adornarla. */}
              {participation?.allowed && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-slate-700 dark:text-slate-300">
                    Cuesta <strong>{participation.pointsCost} puntos</strong>. Le quedarían{' '}
                    <strong>{state.account.balance - participation.pointsCost}</strong>.
                  </p>
                  <p className="mt-1 text-slate-500">
                    Con {state.ticketsInThisRaffle + quantity} de {ticketsIssuedTotal + quantity} números,
                    su chance de ganar sería de {(odds * 100).toFixed(1)} %.
                  </p>
                </div>
              )}

              {participation && !participation.allowed && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200/60 bg-rose-50/50 px-3.5 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <p className="text-xs leading-relaxed text-rose-900 dark:text-rose-200">
                    {participation.message}
                  </p>
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-slate-400">
                {responsiblePlayNotice({ minAge: raffle.min_age })}
              </p>
            </>
          )}

          {/* ── Resultado ───────────────────────────────────────────── */}
          {issued && issued.length > 0 && (
            <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Números asignados
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {issued.map((number) => (
                  <Badge key={number} variant="outline" className="border-emerald-300 font-mono text-xs dark:border-emerald-800">
                    {number}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {issued ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button onClick={handleRedeem} disabled={!participation?.allowed || redeeming}>
            {redeeming && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Canjear {participation?.allowed ? `${participation.pointsCost} puntos` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
