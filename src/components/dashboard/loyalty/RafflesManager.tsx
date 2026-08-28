'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import {
  Coins,
  Gift,
  Loader2,
  Plus,
  ShieldAlert,
  Ticket,
  Trophy,
  Users,
  X,
  Sparkles,
  HelpCircle,
  Calendar,
  CheckCircle2,
  Dice5,
  Eye,
  Info,
  Crown,
  Medal,
  ChevronDown,
  ChevronUp,
  Search,
  ShoppingCart,
} from 'lucide-react'
import { responsiblePlayNotice } from '@/lib/raffles/responsible-play'
import { RaffleRedeemDialog } from './RaffleRedeemDialog'
import type { RaffleRow } from '@/hooks/use-loyalty'

interface RafflesManagerProps {
  raffles: RaffleRow[]
  onCreate: (values: Record<string, unknown>) => Promise<boolean>
  onUpdateStatus: (id: string, status: RaffleRow['status']) => Promise<boolean>
  onDraw: (id: string) => Promise<unknown>
  onRefresh: () => void
  canManage: boolean
}

type WinnerItem = {
  id?: string
  prize_position: number
  prize_title: string
  customer?: { id: string; name: string; email?: string; phone?: string }
  ticket?: { ticket_number: number }
}

type ParticipantCustomer = {
  customer_id: string
  customer_name: string
  customer_phone?: string
  customer_email?: string
  tickets: number[]
}

const STATUS_LABEL: Record<
  RaffleRow['status'],
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; badgeColor: string }
> = {
  draft: { label: 'Borrador', variant: 'secondary', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  published: { label: 'Abierto / En Venta', variant: 'default', badgeColor: 'bg-emerald-500 text-white' },
  closed: { label: 'Cerrado para Sorteo', variant: 'outline', badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  completed: { label: 'Sorteado', variant: 'outline', badgeColor: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' },
  cancelled: { label: 'Cancelado', variant: 'destructive', badgeColor: 'bg-rose-500 text-white' },
}

const EMPTY_RAFFLE = {
  name: '',
  description: '',
  requirements: '',
  terms: '',
  starts_at: '',
  ends_at: '',
  points_per_ticket: 50,
  min_purchase_amount: 100000,
  auto_entry_on_sale: true,
  max_tickets_per_customer: '',
  max_tickets_total: 1000,
  min_age: 0, // Por defecto 0 = Sin restricción de edad
}

function ticketCount(raffle: RaffleRow) {
  return raffle.tickets?.[0]?.count ?? 0
}

export function RafflesManager({
  raffles,
  onCreate,
  onUpdateStatus,
  onDraw,
  onRefresh,
  canManage,
}: RafflesManagerProps) {
  const [redeemFor, setRedeemFor] = useState<RaffleRow | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [drawing, setDrawing] = useState<string | null>(null)
  const [confirmDraw, setConfirmDraw] = useState<RaffleRow | null>(null)
  const [draft, setDraft] = useState(EMPTY_RAFFLE)
  const [prizes, setPrizes] = useState<Array<{ position: number; title: string }>>([
    { position: 1, title: '' },
  ])

  // Modal para ver ganadores de un sorteo
  const [viewWinnersRaffle, setViewWinnersRaffle] = useState<RaffleRow | null>(null)
  const [winnersData, setWinnersData] = useState<WinnerItem[]>([])
  const [loadingWinners, setLoadingWinners] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  // Modal para ver participantes de un sorteo
  const [viewParticipantsRaffle, setViewParticipantsRaffle] = useState<RaffleRow | null>(null)
  const [participantsData, setParticipantsData] = useState<ParticipantCustomer[]>([])
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  const [participantSearch, setParticipantSearch] = useState('')

  const handleCreate = async () => {
    setSaving(true)
    const autoReq = draft.auto_entry_on_sale
      ? `Participación directa: Compras desde Gs. ${Number(draft.min_purchase_amount || 100000).toLocaleString('es-PY')} generan automáticamente números de sorteo. ${draft.requirements || ''}`.trim()
      : draft.requirements || null

    const ok = await onCreate({
      name: draft.name,
      description: draft.description || null,
      requirements: autoReq,
      terms: draft.terms || null,
      prizes: prizes
        .filter((p) => p.title.trim())
        .map((p, i) => ({ position: i + 1, title: p.title.trim() })),
      starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : '',
      ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : '',
      points_per_ticket: Number(draft.points_per_ticket),
      max_tickets_per_customer: draft.max_tickets_per_customer ? Number(draft.max_tickets_per_customer) : null,
      max_tickets_total: Number(draft.max_tickets_total),
      min_age: Number(draft.min_age),
      status: 'draft',
    })
    setSaving(false)

    if (ok) {
      setDraft(EMPTY_RAFFLE)
      setPrizes([{ position: 1, title: '' }])
      setOpen(false)
    }
  }

  const handleDraw = async () => {
    if (!confirmDraw) return
    const id = confirmDraw.id
    setDrawing(id)
    const result = await onDraw(id)
    setDrawing(null)
    setConfirmDraw(null)

    // Cargar automáticamente los ganadores para mostrar el podio
    if (result) {
      handleViewWinners(confirmDraw)
    }
  }

  const handleViewWinners = async (raffle: RaffleRow) => {
    setViewWinnersRaffle(raffle)
    setLoadingWinners(true)
    try {
      const res = await fetch(`/api/raffles/${raffle.id}`)
      if (res.ok) {
        const body = await res.json()
        setWinnersData(body.winners || [])
      }
    } catch {
      setWinnersData([])
    } finally {
      setLoadingWinners(false)
    }
  }

  const handleViewParticipants = async (raffle: RaffleRow) => {
    setViewParticipantsRaffle(raffle)
    setLoadingParticipants(true)
    setParticipantSearch('')
    try {
      const res = await fetch(`/api/raffles/${raffle.id}`)
      if (res.ok) {
        const body = await res.json()
        const rawTickets = body.tickets || []
        const grouped: Record<string, ParticipantCustomer> = {}
        for (const t of rawTickets) {
          const cId = t.customer_id || t.customer?.id || 'anon'
          if (!grouped[cId]) {
            const fullName = t.customer?.name || `${t.customer?.first_name || ''} ${t.customer?.last_name || ''}`.trim()
            grouped[cId] = {
              customer_id: cId,
              customer_name: fullName || 'Cliente Registrado',
              customer_phone: t.customer?.phone || '',
              customer_email: t.customer?.email || '',
              tickets: []
            }
          }
          if (typeof t.ticket_number === 'number') {
            grouped[cId].tickets.push(t.ticket_number)
          }
        }
        setParticipantsData(Object.values(grouped))
      }
    } catch {
      setParticipantsData([])
    } finally {
      setLoadingParticipants(false)
    }
  }

  const filteredParticipants = participantsData.filter((p) => {
    if (!participantSearch.trim()) return true
    const q = participantSearch.toLowerCase().trim()
    const matchName = p.customer_name.toLowerCase().includes(q)
    const matchPhone = p.customer_phone?.toLowerCase().includes(q)
    const matchEmail = p.customer_email?.toLowerCase().includes(q)
    const matchTicket = p.tickets.some((num) => num.toString().includes(q))
    return matchName || matchPhone || matchEmail || matchTicket
  })

  return (
    <div className="space-y-4">
      {/* ── GUÍA INTERACTIVA DE FUNCIONAMIENTO DE SORTEOS ────────────── */}
      <Card className="overflow-hidden border-cyan-200/80 bg-gradient-to-br from-cyan-50/50 via-white to-sky-50/30 dark:border-cyan-900/40 dark:from-cyan-950/20 dark:via-slate-900/60 dark:to-sky-950/20 shadow-xs">
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  ¿Cómo funciona el Sistema de Puntos y Sorteos?
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Lógica transparente, canje de números al azar y extracción inmutable de ganadores.
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowGuide(!showGuide)}
              className="h-8 px-2.5 text-xs text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100/60 dark:hover:bg-cyan-950/50"
            >
              {showGuide ? (
                <>
                  Ocultar guía <ChevronUp className="ml-1 h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Ver guía y ejemplos <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {showGuide && (
          <CardContent className="p-4 pt-1 space-y-4 border-t border-cyan-100 dark:border-cyan-900/30 text-xs">
            {/* 4 Pasos del Flujo */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/50 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-white text-[10px]">
                    1
                  </span>
                  Acumulación en Compras
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Al cobrar en caja (POS) a un cliente registrado, el sistema calcula automáticamente los puntos según la regla configurada (ej: <strong>1 punto por cada Gs. 10.000</strong>).
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/50 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-white text-[10px]">
                    2
                  </span>
                  Crear y Publicar Sorteo
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Defines los premios (ej: 1º Celular, 2º Auriculares), el costo en puntos por ticket (ej: <strong>50 pts</strong>) y la fecha de cierre. Lo publicas para habilitar el canje.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/50 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-white text-[10px]">
                    3
                  </span>
                  Canje de Números al Azar
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  El cliente canjea sus puntos por números. Los números se asignan <strong>aleatoriamente del pool libre</strong> para garantizar imparcialidad y evitar que nadie elija números específicos.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/50 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-white text-[10px]">
                    4
                  </span>
                  Extracción y Ganadores
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Al cerrar el sorteo, presionas <strong>Sortear</strong>. El algoritmo extrae un ganador único por premio con semilla verificable. El sorteo se corre una sola vez y no se puede manipular.
                </p>
              </div>
            </div>

            {/* Ejemplo Práctico Real */}
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-3.5 dark:border-cyan-900/50 dark:bg-cyan-950/30">
              <p className="font-bold text-cyan-950 dark:text-cyan-100 mb-1 flex items-center gap-1.5">
                <Dice5 className="h-4 w-4 text-cyan-600" />
                Ejemplo Práctico de Campaña:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-cyan-900 dark:text-cyan-200">
                <li><strong>Cliente Juan</strong> realiza compras por <strong>Gs. 500.000</strong> durante el mes y acumula <strong>50 puntos</strong>.</li>
                <li>La tienda tiene activo el <strong>&quot;Gran Sorteo Aniversario&quot;</strong> que cuesta <strong>25 puntos por número</strong>.</li>
                <li>Juan va a caja y canjea sus 50 puntos por <strong>2 números</strong>. El sistema le asigna automáticamente los números <strong>#142</strong> y <strong>#789</strong>.</li>
                <li>Llega el día del sorteo: la tienda hace clic en <strong>Sortear</strong> y el sistema selecciona al número <strong>#142</strong> como ganador del 1º Premio.</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── LISTADO Y ADMINISTRACIÓN DE SORTEOS ───────────────────────── */}
      <Card className="rounded-2xl border-slate-200/80 shadow-xs dark:border-slate-800/80">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Gift className="h-4 w-4 text-rose-500" />
                Sorteos de Fidelización
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Crea campañas de sorteos donde los clientes canjean sus puntos acumulados por números participantes.
              </CardDescription>
            </div>
            {canManage && (
              <Button
                size="sm"
                className="shrink-0 gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-md shadow-cyan-600/20"
                onClick={() => setOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo sorteo
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {raffles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-800">
              <Gift className="h-10 w-10 text-slate-300 dark:text-slate-700" />
              <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                Todavía no tienes sorteos creados
              </h4>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Crea un sorteo, carga los premios que vas a regalar y publícalo para que el mostrador pueda canjear números a los clientes.
              </p>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 gap-1.5 text-xs rounded-xl"
                  onClick={() => setOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Crear mi primer sorteo
                </Button>
              )}
            </div>
          ) : (
            raffles.map((raffle) => {
              const status = STATUS_LABEL[raffle.status]
              const issued = ticketCount(raffle)
              const ended = new Date(raffle.ends_at) <= new Date()
              const progressPercent = Math.min(100, Math.round((issued / raffle.max_tickets_total) * 100))

              return (
                <div
                  key={raffle.id}
                  className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 transition-all hover:border-cyan-500/40 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                          {raffle.name}
                        </h3>
                        <Badge variant="outline" className={`text-[10px] font-bold ${status.badgeColor}`}>
                          {status.label}
                        </Badge>
                      </div>

                      {raffle.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {raffle.description}
                        </p>
                      )}

                      {/* Stats & Details Grid */}
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 font-semibold text-cyan-600 dark:text-cyan-400">
                          <Ticket className="h-3.5 w-3.5" />
                          {raffle.points_per_ticket} pts por número
                        </span>
                        <span className="flex items-center gap-1.5 font-medium">
                          <Users className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                          <strong className="text-slate-900 dark:text-slate-100 font-bold">{raffle.participants_count ?? 0}</strong> clientes ({issued} / {raffle.max_tickets_total} números)
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Trophy className="h-3.5 w-3.5 text-amber-500" />
                          {raffle.prizes?.length ?? 0} premio(s)
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          Cierra: <strong className="text-slate-900 dark:text-slate-100">{new Date(raffle.ends_at).toLocaleDateString('es-PY')}</strong>
                        </span>
                      </div>

                      {/* Barra de progreso de tickets */}
                      <div className="w-full max-w-md pt-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {raffle.status === 'completed' && raffle.draw_seed && (
                        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Sorteo certificado e inmutable (Semilla: <code className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{raffle.draw_seed.slice(0, 12)}...</code>)
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {/* Ver Participantes (clientes que compraron/canjearon) */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-semibold"
                        onClick={() => handleViewParticipants(raffle)}
                      >
                        <Users className="h-3.5 w-3.5 text-cyan-600" />
                        Participantes ({raffle.participants_count ?? 0})
                      </Button>

                      {/* Ver Ganadores si ya fue sorteado */}
                      {raffle.status === 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 rounded-xl border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 font-bold text-xs"
                          onClick={() => handleViewWinners(raffle)}
                        >
                          <Trophy className="h-3.5 w-3.5 text-amber-600" />
                          Ver Ganadores
                        </Button>
                      )}

                      {/* Canjear en caja */}
                      {raffle.status === 'published' && !ended && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 rounded-xl border-cyan-200 bg-cyan-50/50 text-cyan-900 hover:bg-cyan-100 text-xs font-semibold dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200"
                          onClick={() => setRedeemFor(raffle)}
                        >
                          <Coins className="h-3.5 w-3.5 text-cyan-600" />
                          Canjear números
                        </Button>
                      )}

                      {canManage && (
                        <>
                          {raffle.status === 'draft' && (
                            <Button
                              size="sm"
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                              onClick={() => onUpdateStatus(raffle.id, 'published')}
                            >
                              Publicar sorteo
                            </Button>
                          )}
                          {raffle.status === 'published' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl text-xs"
                              onClick={() => onUpdateStatus(raffle.id, 'closed')}
                            >
                              Cerrar venta
                            </Button>
                          )}
                          {(raffle.status === 'closed' || (raffle.status === 'published' && ended)) && (
                            <Button
                              size="sm"
                              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-md shadow-amber-500/20"
                              onClick={() => setConfirmDraw(raffle)}
                              disabled={drawing === raffle.id}
                            >
                              {drawing === raffle.id ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trophy className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Sortear Ahora
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* ── MODAL: VER PARTICIPANTES DEL SORTEO ───────────────────────── */}
      <Dialog open={!!viewParticipantsRaffle} onOpenChange={(open) => !open && setViewParticipantsRaffle(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-md shadow-cyan-600/20">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-50">
                  Participantes: {viewParticipantsRaffle?.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Clientes registrados con números de tickets participantes en este sorteo.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Métricas del Sorteo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-2xl border border-cyan-200/80 bg-cyan-50/50 p-3 dark:border-cyan-900/40 dark:bg-cyan-950/20 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Clientes Únicos</span>
              <span className="text-lg font-extrabold text-cyan-700 dark:text-cyan-300">{participantsData.length}</span>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Números Emitidos</span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {participantsData.reduce((acc, p) => acc + p.tickets.length, 0)}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Costo / Ticket</span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {viewParticipantsRaffle?.points_per_ticket ?? 50} pts
              </span>
            </div>
          </div>

          {/* Buscador de Participantes */}
          <div className="relative pt-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar cliente por nombre, teléfono o número de ticket..."
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              className="pl-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 h-9.5"
            />
          </div>

          {/* Listado de Clientes y sus Números */}
          <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
            {loadingParticipants ? (
              <div className="flex items-center justify-center py-10 text-xs text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-cyan-600" />
                Cargando lista de participantes...
              </div>
            ) : filteredParticipants.length === 0 ? (
              <p className="rounded-2xl border border-dashed py-8 text-center text-xs text-slate-500">
                {participantSearch
                  ? 'No se encontraron clientes con ese criterio.'
                  : 'Todavía no hay clientes con números asignados para este sorteo.'}
              </p>
            ) : (
              filteredParticipants.map((participant) => (
                <div
                  key={participant.customer_id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
                        {participant.customer_name}
                      </p>
                      {(participant.customer_phone || participant.customer_email) && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {[participant.customer_phone, participant.customer_email].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 font-bold text-xs shrink-0">
                      {participant.tickets.length} {participant.tickets.length === 1 ? 'número' : 'números'}
                    </Badge>
                  </div>

                  {/* Números asignados */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {participant.tickets.map((tNum) => (
                      <span
                        key={tNum}
                        className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700"
                      >
                        #{tNum}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl text-xs px-4"
              onClick={() => setViewParticipantsRaffle(null)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: VER GANADORES DEL SORTEO ───────────────────────────── */}
      <Dialog open={!!viewWinnersRaffle} onOpenChange={(open) => !open && setViewWinnersRaffle(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <Trophy className="h-5 w-5" />
              <DialogTitle className="text-base font-extrabold">
                Ganadores del Sorteo: {viewWinnersRaffle?.name}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Resultados certificados extraídos al azar con semilla inmutable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {loadingWinners ? (
              <div className="flex items-center justify-center py-8 text-xs text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-cyan-600" />
                Cargando ganadores...
              </div>
            ) : winnersData.length === 0 ? (
              <p className="rounded-xl border border-dashed py-6 text-center text-xs text-slate-500">
                No se registraron ganadores para este sorteo.
              </p>
            ) : (
              <div className="space-y-2.5">
                {winnersData.map((winner, idx) => (
                  <div
                    key={winner.id || idx}
                    className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                      winner.prize_position === 1
                        ? 'border-amber-300 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30'
                        : winner.prize_position === 2
                        ? 'border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/50'
                        : 'border-orange-200 bg-orange-50/50 dark:border-orange-950 dark:bg-orange-950/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-extrabold text-sm shadow-xs ${
                          winner.prize_position === 1
                            ? 'bg-amber-500 text-slate-950'
                            : winner.prize_position === 2
                            ? 'bg-slate-400 text-white'
                            : 'bg-orange-400 text-white'
                        }`}
                      >
                        {winner.prize_position === 1 ? (
                          <Crown className="h-5 w-5" />
                        ) : (
                          `${winner.prize_position}º`
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {winner.prize_position}º Premio: {winner.prize_title}
                        </p>
                        <p className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-50">
                          {winner.customer?.name || 'Cliente registrado'}
                        </p>
                        {(winner.customer?.phone || winner.customer?.email) && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {winner.customer?.phone || winner.customer?.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Número ganador
                      </span>
                      <Badge className="bg-slate-900 text-white font-mono text-xs px-2.5 py-0.5 dark:bg-white dark:text-slate-900">
                        #{winner.ticket?.ticket_number ?? '---'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl text-xs"
              onClick={() => setViewWinnersRaffle(null)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: CREAR SORTEO ───────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px] rounded-3xl p-6 shadow-2xl border-cyan-500/20">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-50">
                  Crear Nuevo Sorteo
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Define los premios, fechas y costos en puntos para habilitar la participación en tu tienda y caja.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* 1. Datos Principales */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-white text-[10px] font-bold">1</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Información Básica
                </h4>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="raffle-name" className="text-xs font-semibold">
                  Nombre de la Campaña de Sorteo <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="raffle-name"
                  placeholder="Ej: Gran Sorteo Aniversario 2026 / Sorteo Mayoristas"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="rounded-xl text-xs bg-white dark:bg-slate-950 font-medium h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="raffle-requirements" className="text-xs font-semibold">
                  Requisitos / Términos de Participación <span className="text-[11px] font-normal text-slate-400">(opcional)</span>
                </Label>
                <Textarea
                  id="raffle-requirements"
                  rows={2}
                  placeholder="Ej: Participan compras mayores a Gs. 100.000 registradas en el mes con cliente identificado."
                  value={draft.requirements}
                  onChange={(e) => setDraft((d) => ({ ...d, requirements: e.target.value }))}
                  className="rounded-xl text-xs bg-white dark:bg-slate-950 resize-none"
                />
              </div>
            </div>

            {/* 2. Premios a Sortear */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">2</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Podio de Premios
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Orden de asignación</span>
              </div>

              <div className="space-y-2.5">
                {prizes.map((prize, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs shadow-xs ${
                        index === 0
                          ? 'bg-amber-500 text-slate-950'
                          : index === 1
                          ? 'bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                          : 'bg-orange-400 text-white'
                      }`}
                    >
                      {index === 0 ? <Crown className="h-4 w-4" /> : `${index + 1}º`}
                    </div>
                    <Input
                      placeholder={
                        index === 0
                          ? '1º Premio (ej: Smartphone Xiaomi Note 13)'
                          : index === 1
                          ? '2º Premio (ej: Auriculares Inalámbricos)'
                          : `${index + 1}º Premio (ej: Vale de Compra Gs. 500.000)`
                      }
                      value={prize.title}
                      onChange={(e) =>
                        setPrizes((current) =>
                          current.map((p, i) => (i === index ? { ...p, title: e.target.value } : p))
                        )
                      }
                      className="rounded-xl text-xs bg-white dark:bg-slate-950 font-medium h-9.5"
                    />
                    {prizes.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        aria-label={`Quitar premio ${index + 1}`}
                        onClick={() => setPrizes((current) => current.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 rounded-xl border-dashed h-8 w-full justify-center"
                onClick={() => setPrizes((current) => [...current, { position: current.length + 1, title: '' }])}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar otro premio al sorteo
              </Button>
            </div>

            {/* 3. Reglas de Participación Automática en Compras (POS / Caja) */}
            <div className="rounded-2xl border border-cyan-200/80 bg-cyan-50/40 p-4 dark:border-cyan-900/40 dark:bg-cyan-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-white text-[10px] font-bold">3</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-950 dark:text-cyan-200">
                    Participación Directa por Compra en Caja (POS)
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="auto-entry-switch" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {draft.auto_entry_on_sale ? 'Activado' : 'Desactivado'}
                  </Label>
                  <Switch
                    id="auto-entry-switch"
                    checked={draft.auto_entry_on_sale}
                    onCheckedChange={(checked) => setDraft((d) => ({ ...d, auto_entry_on_sale: checked }))}
                  />
                </div>
              </div>

              {draft.auto_entry_on_sale ? (
                <div className="space-y-3 pt-1">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="min-purchase" className="text-xs font-semibold">
                        Monto Mínimo de Compra para Recibir Número
                      </Label>
                      <Input
                        id="min-purchase"
                        type="number"
                        min={1000}
                        step={10000}
                        value={draft.min_purchase_amount}
                        onChange={(e) => setDraft((d) => ({ ...d, min_purchase_amount: Number(e.target.value) }))}
                        className="rounded-xl text-xs bg-white dark:bg-slate-950 font-semibold h-9.5"
                      />
                      <p className="text-[10px] text-slate-500">Ej: 100.000 Gs (compras desde este monto participan)</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        Generación Escalonada
                      </Label>
                      <div className="rounded-xl border border-slate-200/80 bg-white p-2 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 h-9.5 flex items-center">
                        Cada <strong>Gs. {Number(draft.min_purchase_amount || 100000).toLocaleString('es-PY')}</strong> de compra = <strong>+1 número</strong>
                      </div>
                      <p className="text-[10px] text-slate-500">Se acumulan números proporcionales al total</p>
                    </div>
                  </div>

                  {/* Simulador Interactivo en Vivo */}
                  <div className="rounded-xl border border-cyan-200 bg-white/90 p-3 dark:border-cyan-900/60 dark:bg-slate-900/80 space-y-1.5">
                    <p className="text-[11px] font-bold text-cyan-950 dark:text-cyan-100 flex items-center gap-1.5">
                      <ShoppingCart className="h-3.5 w-3.5 text-cyan-600" />
                      Simulación en Vivo de cómo se calculan los números en Caja:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2 border border-slate-200/60 dark:border-slate-700">
                        <span className="text-slate-500 block text-[10px]">Compra menor:</span>
                        <strong>Gs. {(Number(draft.min_purchase_amount || 100000) * 0.5).toLocaleString('es-PY')}</strong>
                        <span className="block text-slate-400 text-[10px]">→ 0 números</span>
                      </div>
                      <div className="rounded-lg bg-cyan-50 dark:bg-cyan-950/40 p-2 border border-cyan-200 dark:border-cyan-800">
                        <span className="text-cyan-700 dark:text-cyan-300 block text-[10px]">Compra calificada:</span>
                        <strong>Gs. {Number(draft.min_purchase_amount || 100000).toLocaleString('es-PY')}</strong>
                        <span className="block text-cyan-700 dark:text-cyan-300 font-bold text-[10px]">→ 1 número (#142)</span>
                      </div>
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-emerald-700 dark:text-emerald-300 block text-[10px]">Compra triple:</span>
                        <strong>Gs. {(Number(draft.min_purchase_amount || 100000) * 3).toLocaleString('es-PY')}</strong>
                        <span className="block text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">→ 3 números (#042, #189, #705)</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                      🧾 Los números asignados se imprimen automáticamente en el comprobante fiscal/ticket de venta del cliente.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Modo manual: Los números solo se obtendrán cuando el cliente canjee sus puntos acumulados en caja.
                </p>
              )}
            </div>

            {/* 4. Fechas y Horarios */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">4</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Período de Participación
                </h4>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="raffle-start" className="text-xs font-semibold">
                    Inicio de Canje / Venta
                  </Label>
                  <Input
                    id="raffle-start"
                    type="datetime-local"
                    value={draft.starts_at}
                    onChange={(e) => setDraft((d) => ({ ...d, starts_at: e.target.value }))}
                    className="rounded-xl text-xs bg-white dark:bg-slate-950 h-9.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="raffle-end" className="text-xs font-semibold">
                    Cierre y Fecha de Sorteo
                  </Label>
                  <Input
                    id="raffle-end"
                    type="datetime-local"
                    value={draft.ends_at}
                    onChange={(e) => setDraft((d) => ({ ...d, ends_at: e.target.value }))}
                    className="rounded-xl text-xs bg-white dark:bg-slate-950 h-9.5"
                  />
                </div>
              </div>
            </div>

            {/* 5. Reglas de Tickets y Puntos */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold">5</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Reglas de Tickets y Puntos
                </h4>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="raffle-cost" className="text-xs font-semibold">
                    Puntos por Número
                  </Label>
                  <Input
                    id="raffle-cost"
                    type="number"
                    min={1}
                    value={draft.points_per_ticket}
                    onChange={(e) => setDraft((d) => ({ ...d, points_per_ticket: Number(e.target.value) }))}
                    className="rounded-xl text-xs bg-white dark:bg-slate-950 h-9.5"
                  />
                  <p className="text-[10px] text-slate-400">Puntos a descontar</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="raffle-per-customer" className="text-xs font-semibold">
                    Máx. por Cliente
                  </Label>
                  <Input
                    id="raffle-per-customer"
                    type="number"
                    min={1}
                    placeholder="Sin límite"
                    value={draft.max_tickets_per_customer}
                    onChange={(e) => setDraft((d) => ({ ...d, max_tickets_per_customer: e.target.value }))}
                    className="rounded-xl text-xs bg-white dark:bg-slate-950 h-9.5"
                  />
                  <p className="text-[10px] text-slate-400">Dejar vacío = Ilimitado</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="raffle-pool" className="text-xs font-semibold">
                    Cupo Total Números
                  </Label>
                  <Input
                    id="raffle-pool"
                    type="number"
                    min={1}
                    value={draft.max_tickets_total}
                    onChange={(e) => setDraft((d) => ({ ...d, max_tickets_total: Number(e.target.value) }))}
                    className="rounded-xl text-xs bg-white dark:bg-slate-950 h-9.5"
                  />
                  <p className="text-[10px] text-slate-400">Pool máx. (ej: 1000)</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="raffle-age" className="text-xs font-semibold">
                    Edad Mínima
                  </Label>
                  <Input
                    id="raffle-age"
                    type="number"
                    min={0}
                    max={99}
                    value={draft.min_age}
                    onChange={(e) => setDraft((d) => ({ ...d, min_age: Number(e.target.value) }))}
                    className="rounded-xl text-xs bg-white dark:bg-slate-950 h-9.5"
                  />
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {Number(draft.min_age) > 0 ? `${draft.min_age}+ años` : '0 = Sin restricción'}
                  </p>
                </div>
              </div>

              {/* Guía Explicativa de Reglas y Ejemplos en Vivo */}
              <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20 space-y-2 text-xs">
                <p className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 text-[11px]">
                  <Info className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  ¿Cómo funcionan estas reglas? Ejemplos prácticos:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <div className="rounded-lg bg-white dark:bg-slate-900/80 p-2.5 border border-indigo-100 dark:border-indigo-900/30">
                    <strong className="text-indigo-700 dark:text-indigo-300 block mb-0.5">
                      🎟️ Puntos por Número ({draft.points_per_ticket} pts):
                    </strong>
                    Si un cliente acumuló 150 puntos y el ticket cuesta {draft.points_per_ticket} pts, puede canjear {Math.floor(150 / (Number(draft.points_per_ticket) || 1))} números en caja.
                  </div>
                  <div className="rounded-lg bg-white dark:bg-slate-900/80 p-2.5 border border-indigo-100 dark:border-indigo-900/30">
                    <strong className="text-indigo-700 dark:text-indigo-300 block mb-0.5">
                      👤 Máx. por Cliente ({draft.max_tickets_per_customer ? `${draft.max_tickets_per_customer} tickets` : 'Ilimitado'}):
                    </strong>
                    {draft.max_tickets_per_customer
                      ? `Ningún cliente podrá tener más de ${draft.max_tickets_per_customer} números, garantizando que nadie acapare los premios.`
                      : 'Sin límite: un cliente puede acumular todos los números que alcance con sus compras.'}
                  </div>
                  <div className="rounded-lg bg-white dark:bg-slate-900/80 p-2.5 border border-indigo-100 dark:border-indigo-900/30">
                    <strong className="text-indigo-700 dark:text-indigo-300 block mb-0.5">
                      📦 Cupo Total ({Number(draft.max_tickets_total || 1000).toLocaleString('es-PY')} números):
                    </strong>
                    Talonario del #1 al #{Number(draft.max_tickets_total || 1000).toLocaleString('es-PY')}. Los números se eligen al azar del pool libre sin duplicados.
                  </div>
                  <div className="rounded-lg bg-white dark:bg-slate-900/80 p-2.5 border border-indigo-100 dark:border-indigo-900/30">
                    <strong className="text-indigo-700 dark:text-indigo-300 block mb-0.5">
                      🎂 Edad ({Number(draft.min_age) > 0 ? `${draft.min_age}+ años` : 'Todas las edades'}):
                    </strong>
                    {Number(draft.min_age) > 0
                      ? `Exclusivo para mayores de ${draft.min_age} años con control de juego responsable.`
                      : '0 = Sin restricción de edad. Apto para familias y todo público.'}
                  </div>
                </div>
              </div>

              {/* Indicador de Restricción de Edad */}
              {Number(draft.min_age) > 0 ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                    {responsiblePlayNotice({ minAge: Number(draft.min_age) })}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                    Sorteo apto para todas las edades (Sin restricción de edad por defecto).
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl text-xs h-9.5 px-4"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={saving || !draft.name.trim()}
              className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs h-9.5 px-5 shadow-md shadow-cyan-600/20"
            >
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Crear Sorteo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RaffleRedeemDialog
        raffle={redeemFor}
        onOpenChange={(open) => !open && setRedeemFor(null)}
        onRedeemed={onRefresh}
      />

      {/* ── MODAL: CONFIRMAR SORTEO ───────────────────────────────────── */}
      <AlertDialog open={!!confirmDraw} onOpenChange={(value) => !value && setConfirmDraw(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              ¿Realizar Sorteo &laquo;{confirmDraw?.name}&raquo;?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>
                Se seleccionará al azar <strong>1 ganador único por cada premio</strong> entre los{' '}
                <strong>{confirmDraw ? ticketCount(confirmDraw) : 0} números canjeados</strong>.
              </p>
              <p className="font-semibold text-rose-600 dark:text-rose-400">
                ⚠️ Esta acción es definitiva: se ejecuta una sola vez y no se puede revertir ni repetir.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDraw}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-md shadow-amber-500/20"
            >
              Confirmar y Sortear Ahora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
