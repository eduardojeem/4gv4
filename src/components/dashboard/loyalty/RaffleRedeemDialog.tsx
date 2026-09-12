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
import { Coins, Loader2, Search, ShieldAlert, Ticket, User, CreditCard, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  const [mode, setMode] = useState<'redeem' | 'buy_points'>('redeem')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash')

  const defaultPricePerPoint = (() => {
    if (raffle?.point_purchase_price && raffle.point_purchase_price > 0) return raffle.point_purchase_price
    if (!raffle?.requirements) return 1000
    const match = raffle.requirements.match(/Gs\.\s*([\d.]+)\s*por punto/i)
    if (match && match[1]) {
      const clean = Number(match[1].replace(/\./g, ''))
      if (!isNaN(clean) && clean > 0) return clean
    }
    return 1000
  })()
  const [pricePerPoint, setPricePerPoint] = useState(defaultPricePerPoint)

  const ticketsIssuedTotal = raffle?.tickets?.[0]?.count ?? 0
  const pointsPerTicket = raffle?.points_per_ticket || 50
  const pointsToBuy = quantity * pointsPerTicket
  const totalCashToCharge = pointsToBuy * (pricePerPoint || 1000)

  // Se limpia todo al abrir con otro sorteo: dejar el cliente anterior
  // seleccionado invitaría a canjear en el sorteo equivocado.
  useEffect(() => {
    setSearch('')
    setCustomers([])
    setSelected(null)
    setState(null)
    setQuantity(1)
    setIssued(null)
    setMode('redeem')
    setPricePerPoint(defaultPricePerPoint)
  }, [raffle?.id, defaultPricePerPoint])

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

  const handleBuyAndRedeem = async () => {
    if (!selected || !raffle) return
    if (raffle.allow_point_purchase === false) {
      toast.error('La compra directa de puntos no está habilitada para este sorteo')
      return
    }
    setRedeeming(true)
    try {
      const response = await fetch(`/api/raffles/${raffle.id}/tickets/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selected.id,
          quantity,
          payment_method: paymentMethod,
        }),
      })
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(body?.error ?? 'No se pudo completar el cobro y la emisión de números.')
        return
      }

      const numbers = (body?.tickets ?? []).map((t: { ticket_number: number }) => t.ticket_number)
      setIssued(numbers)
      toast.success(`¡Venta exitosa! ${numbers.length} número(s) asignados al cliente`)
      onRedeemed()
      await loadCustomerState(selected)
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <Dialog open={!!raffle} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
        <DialogTitle>Asignar números al cliente</DialogTitle>
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

          {/* ── Cantidad y Modo de Participación ───────────────────────── */}
          {state && !loadingState && (
            <div className="space-y-4 pt-1">
              {/* Selector de Modo */}
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setMode('redeem')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer',
                    mode === 'redeem'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-slate-50 font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  <Coins className="h-3.5 w-3.5 text-amber-500" />
                  Saldo de Puntos
                </button>
                <button
                  type="button"
                  onClick={() => setMode('buy_points')}
                  disabled={raffle.allow_point_purchase === false}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer',
                    mode === 'buy_points'
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200',
                    raffle.allow_point_purchase === false && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  {raffle.allow_point_purchase === false ? 'Compra de puntos desactivada' : 'Comprar puntos en caja'}
                </button>
              </div>

              {mode === 'redeem' ? (
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
                </>
              ) : (
                <div className="space-y-3.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">💳</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950 dark:text-emerald-200">
                      Venta directa de puntos para sorteo
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="buy-qty" className="text-xs font-semibold">
                        Cantidad de Números
                      </Label>
                      <Input
                        id="buy-qty"
                        type="number"
                        min={1}
                        max={100}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                        className="bg-white dark:bg-slate-900 text-xs font-bold"
                      />
                      <p className="text-[10px] text-slate-500">{pointsToBuy} puntos necesarios ({pointsPerTicket} pts/número)</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="price-per-pt" className="text-xs font-semibold">
                        Monto por Punto (Gs.)
                      </Label>
                      <Input
                        id="price-per-pt"
                        type="number"
                        min={100}
                        step={100}
                        value={pricePerPoint}
                        onChange={(e) => setPricePerPoint(Math.max(100, Number(e.target.value) || 1000))}
                        className="bg-white dark:bg-slate-900 text-xs font-semibold"
                      />
                      <p className="text-[10px] text-slate-500">Monto configurado para este sorteo</p>
                    </div>
                  </div>

                  {/* Resumen de cobro en caja */}
                  <div className="rounded-xl border border-emerald-300 bg-white p-3 text-xs dark:border-emerald-800 dark:bg-slate-900 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Puntos a acreditar:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{pointsToBuy} pts</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-1">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 text-xs">Total a cobrar en caja:</span>
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        Gs. {totalCashToCharge.toLocaleString('es-PY')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="points-payment-method" className="text-xs font-semibold">Medio de pago recibido</Label>
                    <select
                      id="points-payment-method"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value as 'cash' | 'transfer' | 'card')}
                      className="h-9 w-full rounded-xl border border-emerald-200 bg-white px-3 text-xs font-medium dark:border-emerald-800 dark:bg-slate-900"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                      <option value="card">Tarjeta</option>
                    </select>
                  </div>
                  <p className="text-[11px] leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
                    El cobro acredita los puntos y luego emite los números. Verifica el medio de pago en tu caja antes de confirmar.
                  </p>
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-slate-400">
                {responsiblePlayNotice({ minAge: raffle.min_age })}
              </p>
            </div>
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
          {mode === 'redeem' ? (
            <Button onClick={handleRedeem} disabled={!participation?.allowed || redeeming}>
              {redeeming && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Canjear {participation?.allowed ? `${participation.pointsCost} puntos` : ''}
            </Button>
          ) : (
            <Button
              onClick={handleBuyAndRedeem}
              disabled={redeeming || !selected}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {redeeming && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Cobrar Gs. {totalCashToCharge.toLocaleString('es-PY')} y Asignar Números
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
