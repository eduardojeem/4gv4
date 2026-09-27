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
  Dice5,
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
  Eye,
  EyeOff,
  Crown,
  Medal,
  ChevronDown,
  ChevronUp,
  Search, Copy,
  Check, MessageCircle,
  ShieldCheck,
  Phone,
  Mail
} from 'lucide-react'
import { toast } from 'sonner'
import { responsiblePlayNotice } from '@/lib/raffles/responsible-play'
import { formatCurrency } from '@/lib/currency'
import { explainSpending } from '@/lib/loyalty/explain'
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

export interface RaffleTemplate {
  id: string
  label: string
  badge: string
  icon: string
  description: string
  name: string
  shortDescription: string
  requirements: string
  terms: string
  points_per_ticket: number
  min_purchase_amount: number
  auto_entry_on_sale: boolean
  allow_point_purchase: boolean
  point_purchase_price: number
  max_tickets_per_customer: string
  max_tickets_total: number
  min_age: number
  durationDays: number
  prizes: Array<{ position: number; title: string }>
}

export const RAFFLE_TEMPLATES: RaffleTemplate[] = [
  {
    id: 'anniversary',
    label: 'Gran Sorteo Aniversario',
    badge: 'Popular',
    icon: '🎂',
    description: '3 premios escalonados de alto impacto para celebrar con tus clientes.',
    name: 'Gran Sorteo Aniversario de la Tienda',
    shortDescription: '¡Celebramos nuestro aniversario premiando tu preferencia con increíbles premios!',
    requirements: 'Participan clientes registrados con compras en el local o canjeando/comprando puntos para el sorteo.',
    terms: 'Sorteo transparente certificado por sistema. Los ganadores se anunciarán en nuestras redes y serán contactados por WhatsApp.',
    points_per_ticket: 50,
    min_purchase_amount: 100000,
    auto_entry_on_sale: false,
    allow_point_purchase: false,
    point_purchase_price: 1000,
    max_tickets_per_customer: '20',
    max_tickets_total: 1000,
    min_age: 0,
    durationDays: 30,
    prizes: [
      { position: 1, title: '1º Premio: Vale de Compra por Gs. 1.000.000' },
      { position: 2, title: '2º Premio: Smartwatch Pro / Auriculares Inalámbricos' },
      { position: 3, title: '3º Premio: Kit de Productos Exclusivos de la Tienda' },
    ],
  },
  {
    id: 'vip_loyalty',
    label: 'Fidelidad Clientes VIP',
    badge: 'Fidelización',
    icon: '👑',
    description: 'Recompensa mensual exclusiva para compradores recurrentes.',
    name: 'Sorteo Mensual Fidelidad Clientes VIP',
    shortDescription: 'Premiamos a nuestros clientes frecuentes de todos los meses.',
    requirements: 'Participan compras mayores a Gs. 50.000 o clientes con 30+ puntos de fidelidad.',
    terms: 'Válido para clientes con ficha y teléfono verificado. Notificación directa al ganador.',
    points_per_ticket: 30,
    min_purchase_amount: 50000,
    auto_entry_on_sale: false,
    allow_point_purchase: false,
    point_purchase_price: 1000,
    max_tickets_per_customer: '10',
    max_tickets_total: 500,
    min_age: 0,
    durationDays: 20,
    prizes: [
      { position: 1, title: '1º Premio: Smartphone / Dispositivo de Última Generación' },
      { position: 2, title: '2º Premio: 50% de Descuento en tu próxima compra' },
    ],
  },
  {
    id: 'weekend_flash',
    label: 'Relámpago Fin de Semana',
    badge: 'Exprés',
    icon: '⚡',
    description: 'Sorteo rápido de fin de semana para dinamizar las ventas en caja.',
    name: 'Sorteo Relámpago de Fin de Semana',
    shortDescription: '¡Comprá este fin de semana y participá por premios al instante!',
    requirements: 'Participan compras y canjes de puntos realizados de viernes a domingo.',
    terms: 'Sorteo automático este domingo a las 20:00 hs.',
    points_per_ticket: 20,
    min_purchase_amount: 30000,
    auto_entry_on_sale: false,
    allow_point_purchase: false,
    point_purchase_price: 1000,
    max_tickets_per_customer: '5',
    max_tickets_total: 250,
    min_age: 0,
    durationDays: 3,
    prizes: [
      { position: 1, title: '1º Premio: Gift Card / Tarjeta Regalo Gs. 300.000' },
      { position: 2, title: '2º Premio: Vale de Compra Gs. 150.000' },
    ],
  },
]

function formatDateTimeLocal(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Un sorteo nuevo arranca con el camino simple: el cliente junta puntos
 * comprando y los canjea por tickets cuando quiere.
 *
 * Las dos opciones que estaban prendidas por defecto quedan apagadas, porque
 * ninguna de las dos es lo que el nombre sugiere:
 *
 * - `auto_entry_on_sale` no reparte números por comprar: **gasta los puntos
 *   del cliente** al cerrar la venta, hasta cinco tickets, sin preguntarle
 *   (ver `tryAutoRaffleEntryForSale`). Gastar el saldo de alguien sin que lo
 *   pida no puede ser el valor por defecto.
 * - `allow_point_purchase` deja pagar los puntos en efectivo, o sea vender
 *   números de sorteo por plata. Es una decisión del negocio, no algo que
 *   deba venir puesto.
 */
const EMPTY_RAFFLE = {
  name: '',
  description: '',
  requirements: '',
  terms: '',
  starts_at: '',
  ends_at: '',
  points_per_ticket: 50,
  min_purchase_amount: 100000,
  auto_entry_on_sale: false,
  allow_point_purchase: false,
  point_purchase_price: 1000,
  max_tickets_per_customer: '',
  max_tickets_total: 1000,
  min_age: 0, // Por defecto 0 = Sin restricción de edad
}

function ticketCount(raffle: RaffleRow) {
  return raffle.tickets?.[0]?.count ?? 0
}

/** Oculta parcialmente un número de teléfono para privacidad (ej. 0981 •••• 456 o +595 981 •••• 456) */
function maskPhone(phone?: string | null): string {
  if (!phone) return ''
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length <= 4) return trimmed

  const startDigits = digits.length >= 10 ? 4 : 3
  const endDigits = 3
  const start = digits.slice(0, startDigits)
  const end = digits.slice(-endDigits)
  const isPlus = trimmed.startsWith('+')

  return `${isPlus ? '+' : ''}${start} •••• ${end}`
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
  const [confirmClose, setConfirmClose] = useState<RaffleRow | null>(null)
  const [draft, setDraft] = useState(EMPTY_RAFFLE)
  const [prizes, setPrizes] = useState<Array<{ position: number; title: string }>>([
    { position: 1, title: '' },
  ])

  const applyTemplate = (template: RaffleTemplate) => {
    const now = new Date()
    const startDate = new Date(now.getTime() - 60000)
    const endDate = new Date(now.getTime() + template.durationDays * 24 * 60 * 60 * 1000)

    setDraft({
      name: template.name,
      description: template.shortDescription,
      requirements: template.requirements,
      terms: template.terms,
      starts_at: formatDateTimeLocal(startDate),
      ends_at: formatDateTimeLocal(endDate),
      points_per_ticket: template.points_per_ticket,
      min_purchase_amount: template.min_purchase_amount,
      auto_entry_on_sale: template.auto_entry_on_sale,
      allow_point_purchase: template.allow_point_purchase,
      point_purchase_price: template.point_purchase_price,
      max_tickets_per_customer: template.max_tickets_per_customer,
      max_tickets_total: template.max_tickets_total,
      min_age: template.min_age,
    })
    setPrizes(template.prizes)
  }

  // Modal para ver ganadores de un sorteo
  const [viewWinnersRaffle, setViewWinnersRaffle] = useState<RaffleRow | null>(null)
  const [winnersData, setWinnersData] = useState<WinnerItem[]>([])
  const [loadingWinners, setLoadingWinners] = useState(false)
  const [copiedWinners, setCopiedWinners] = useState(false)
  const [showAuditDetails, setShowAuditDetails] = useState(false)
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({})
  const [showGuide, setShowGuide] = useState(false)

  const toggleRevealPhone = (key: string) => {
    setRevealedPhones((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Modal para ver participantes de un sorteo
  const [viewParticipantsRaffle, setViewParticipantsRaffle] = useState<RaffleRow | null>(null)
  const [participantsData, setParticipantsData] = useState<ParticipantCustomer[]>([])
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  const [participantSearch, setParticipantSearch] = useState('')

  const handleCreate = async () => {
    setSaving(true)
    let autoReq = draft.requirements || ''
    if (draft.auto_entry_on_sale) {
      const entryText = `Participación directa: Compras desde Gs. ${Number(draft.min_purchase_amount || 100000).toLocaleString('es-PY')} generan automáticamente números de sorteo.`
      autoReq = `${entryText} ${autoReq}`.trim()
    }
    if (draft.allow_point_purchase) {
      const pricePerTicket = (Number(draft.point_purchase_price) || 1000) * (Number(draft.points_per_ticket) || 50)
      const purchaseText = `Compra de puntos disponible en caja: Gs. ${Number(draft.point_purchase_price || 1000).toLocaleString('es-PY')} por punto (Gs. ${pricePerTicket.toLocaleString('es-PY')} por número).`
      autoReq = `${autoReq} · ${purchaseText}`.trim()
    }

    const ok = await onCreate({
      name: draft.name,
      description: draft.description || null,
      requirements: autoReq || null,
      terms: draft.terms || null,
      min_purchase_amount: draft.auto_entry_on_sale ? Number(draft.min_purchase_amount || 100000) : null,
      auto_entry_on_sale: draft.auto_entry_on_sale,
      allow_point_purchase: draft.allow_point_purchase,
      point_purchase_price: draft.allow_point_purchase ? Number(draft.point_purchase_price || 1000) : null,
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
    const raffleToDraw = confirmDraw
    const id = raffleToDraw.id
    setDrawing(id)
    const result = await onDraw(id)
    setDrawing(null)
    setConfirmDraw(null)

    // Cargar y mostrar inmediatamente el modal de ganadores al terminar el sorteo
    if (result) {
      const completedRaffle: RaffleRow = {
        ...raffleToDraw,
        status: 'completed',
        drawn_at: new Date().toISOString(),
      }
      setViewWinnersRaffle(completedRaffle)
      if (Array.isArray(result) && result.length > 0) {
        setWinnersData(result as WinnerItem[])
      }
      await handleViewWinners(completedRaffle)
    }
  }

  const handleViewWinners = async (raffle: RaffleRow) => {
    setViewWinnersRaffle(raffle)
    setLoadingWinners(true)
    try {
      const res = await fetch(`/api/raffles/${raffle.id}`)
      if (res.ok) {
        const body = await res.json()
        if (body.raffle) {
          setViewWinnersRaffle(body.raffle)
        }
        setWinnersData(body.winners || [])
      }
    } catch {
      setWinnersData([])
    } finally {
      setLoadingWinners(false)
    }
  }

  const handleCopyWinners = () => {
    if (!viewWinnersRaffle || winnersData.length === 0) return
    const dateStr = viewWinnersRaffle.drawn_at
      ? new Date(viewWinnersRaffle.drawn_at).toLocaleDateString('es-AR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleDateString('es-AR')

    const lines = [
      `🎉 ¡GANADORES DEL SORTEO OFICIAL! 🎉`,
      `🏆 Sorteo: ${viewWinnersRaffle.name}`,
      `📅 Realizado: ${dateStr}`,
      '',
      '🥇 LISTA DE GANADORES:',
      ...winnersData.map((w) => {
        const medal =
          w.prize_position === 1
            ? '🥇 1º Puesto'
            : w.prize_position === 2
            ? '🥈 2º Puesto'
            : w.prize_position === 3
            ? '🥉 3º Puesto'
            : `🎖️ ${w.prize_position}º Puesto`
        const ticket = w.ticket?.ticket_number ? ` (Boleto #${w.ticket.ticket_number})` : ''
        const name = w.customer?.name || 'Cliente Registrado'
        return `${medal}: ${w.prize_title}\n   Ganador: ${name}${ticket}`
      }),
      '',
      viewWinnersRaffle.draw_seed
        ? `🔐 Semilla de Auditoría: ${viewWinnersRaffle.draw_seed}`
        : '',
      '',
      '¡Felicitaciones a los afortunados y gracias a todos por participar!',
    ].filter(Boolean)

    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedWinners(true)
    toast.success('Lista de ganadores copiada al portapapeles')
    setTimeout(() => setCopiedWinners(false), 3000)
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
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-8 sm:p-10 text-center dark:border-slate-800">
              <Gift className="h-10 w-10 text-slate-300 dark:text-slate-700" />
              <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                Todavía no tienes sorteos creados
              </h4>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                Lanza una campaña para fidelizar clientes y aumentar tus ventas. Puedes usar una plantilla lista para usar o crear uno a medida.
              </p>
              {canManage && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold shadow-md shadow-cyan-600/20"
                    onClick={() => {
                      applyTemplate(RAFFLE_TEMPLATES[0])
                      setOpen(true)
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Usar Plantilla Recomendada (Aniversario)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs rounded-xl"
                    onClick={() => {
                      setDraft(EMPTY_RAFFLE)
                      setPrizes([{ position: 1, title: '' }])
                      setOpen(true)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Crear sorteo personalizado
                  </Button>
                </div>
              )}
            </div>
          ) : (
            raffles.map((raffle) => {
              const status = STATUS_LABEL[raffle.status]
              const issued = ticketCount(raffle)
              const ended = new Date(raffle.ends_at) <= new Date()
              const progressPercent = Math.min(100, Math.round((issued / raffle.max_tickets_total) * 100))
              const hasPointPurchase = raffle.requirements?.toLowerCase().includes('compra de puntos') || raffle.requirements?.toLowerCase().includes('comprando puntos')

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
                        {hasPointPurchase && (
                          <Badge variant="outline" className="text-[10px] font-medium border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            💳 Compra de puntos disponible
                          </Badge>
                        )}
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
                              // Cerrar no tiene vuelta atrás: un sorteo cerrado no se
                              // puede volver a publicar y ya nadie puede canjear. Antes
                              // se hacía de un clic, sin preguntar nada.
                              onClick={() => setConfirmClose(raffle)}
                            >
                              Cerrar venta
                            </Button>
                          )}
                          {(raffle.status === 'closed' || (raffle.status === 'published' && ended)) && (
                            <Button
                              size="sm"
                              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-md shadow-amber-500/20"
                              onClick={() => setConfirmDraw(raffle)}
                              // Sin números canjeados no hay entre quiénes sortear: la
                              // base lo rechaza. Antes el botón invitaba igual, pedía
                              // confirmar «esta acción es definitiva» y recién ahí fallaba.
                              disabled={drawing === raffle.id || ticketCount(raffle) === 0}
                              title={ticketCount(raffle) === 0 ? 'Todavía nadie canjeó números en este sorteo' : undefined}
                            >
                              {drawing === raffle.id ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trophy className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Sortear Ahora
                            </Button>
                          )}
                          {(raffle.status === 'closed' || (raffle.status === 'published' && ended)) &&
                            ticketCount(raffle) === 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              Nadie canjeó números: no hay a quién sortear.
                            </span>
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
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-amber-500/30 shadow-2xl bg-card">
          <DialogHeader className="p-5 pb-4 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-emerald-500/15 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-emerald-950/40 border-b border-amber-500/20 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/25">
                <Trophy className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/30 text-[10px] uppercase font-bold tracking-wider">
                    🎉 Resultados Oficiales
                  </Badge>
                  {viewWinnersRaffle?.drawn_at && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                      <Calendar className="h-3 w-3" />
                      {new Date(viewWinnersRaffle.drawn_at).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate mt-1">
                  {viewWinnersRaffle?.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-600 dark:text-slate-400">
                  Ganadores certificados y seleccionados al azar mediante algoritmo auditado.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {loadingWinners && winnersData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 animate-pulse">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
                <p className="text-xs font-semibold">Cargando ganadores certificados...</p>
              </div>
            ) : winnersData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-10 text-center space-y-2">
                <HelpCircle className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  No se registraron ganadores para este sorteo.
                </p>
                <p className="text-[11px] text-slate-400">
                  Verificá que el sorteo haya tenido participantes activos al momento de cerrarlo.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {winnersData.map((winner, idx) => {
                  const isFirst = winner.prize_position === 1
                  const isSecond = winner.prize_position === 2
                  const isThird = winner.prize_position === 3
                  const customerName = winner.customer?.name || 'Cliente Registrado'
                  const customerPhone = winner.customer?.phone
                  const customerEmail = winner.customer?.email
                  const ticketNumber = winner.ticket?.ticket_number ?? '---'
                  const rawPhone = customerPhone ? customerPhone.replace(/\D/g, '') : null

                  return (
                    <div
                      key={winner.id || idx}
                      className={`relative rounded-2xl border p-4 transition-all ${
                        isFirst
                          ? 'border-amber-400/90 bg-gradient-to-br from-amber-500/15 via-amber-400/5 to-transparent shadow-md shadow-amber-500/10 dark:border-amber-500/40 dark:from-amber-950/40'
                          : isSecond
                          ? 'border-slate-300 bg-gradient-to-br from-slate-200/40 to-transparent dark:border-slate-700 dark:bg-slate-900/50'
                          : isThird
                          ? 'border-orange-200 bg-gradient-to-br from-orange-100/40 to-transparent dark:border-orange-900/40 dark:bg-orange-950/30'
                          : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30'
                      }`}
                    >
                      {/* Cabecera del Ganador: Posición y Premio */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-sm shadow-xs ${
                              isFirst
                                ? 'bg-gradient-to-tr from-amber-400 to-yellow-400 text-slate-950 shadow-amber-500/20'
                                : isSecond
                                ? 'bg-slate-300 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                                : isThird
                                ? 'bg-orange-400 text-white shadow-orange-500/20'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {isFirst ? (
                              <Crown className="h-5 w-5" />
                            ) : isSecond || isThird ? (
                              <Medal className="h-5 w-5" />
                            ) : (
                              `${winner.prize_position}º`
                            )}
                          </div>
                          <div className="min-w-0">
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider block ${
                                isFirst
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : isSecond
                                  ? 'text-slate-600 dark:text-slate-300'
                                  : isThird
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {winner.prize_position}º Puesto
                            </span>
                            <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-50 truncate">
                              {winner.prize_title}
                            </h4>
                          </div>
                        </div>

                        {/* Boleto Ganador */}
                        <div className="text-right shrink-0">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                            Boleto Ganador
                          </span>
                          <Badge className="bg-slate-950 text-amber-400 font-mono text-xs px-2.5 py-0.5 border border-amber-400/30 dark:bg-black dark:text-amber-300">
                            <Ticket className="h-3 w-3 mr-1 text-amber-400" />
                            #{ticketNumber}
                          </Badge>
                        </div>
                      </div>

                      {/* Datos del Cliente y Acciones de Contacto */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-extrabold text-slate-700 dark:text-slate-300">
                              {customerName.charAt(0).toUpperCase()}
                            </span>
                            {customerName}
                          </p>
                          {(customerPhone || customerEmail) && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                              {customerPhone && (
                                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100/90 dark:bg-slate-800/90 px-2 py-0.5 rounded-lg border border-slate-200/70 dark:border-slate-700/70">
                                  <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span>
                                    {revealedPhones[winner.id || String(idx)]
                                      ? customerPhone
                                      : maskPhone(customerPhone)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealPhone(winner.id || String(idx))}
                                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ml-0.5 transition-colors p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                                    title={revealedPhones[winner.id || String(idx)] ? 'Ocultar número' : 'Ver número completo'}
                                    aria-label={revealedPhones[winner.id || String(idx)] ? 'Ocultar número' : 'Ver número completo'}
                                  >
                                    {revealedPhones[winner.id || String(idx)] ? (
                                      <EyeOff className="h-3 w-3" />
                                    ) : (
                                      <Eye className="h-3 w-3" />
                                    )}
                                  </button>
                                </span>
                              )}
                              {customerEmail && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3 text-slate-400" />
                                  {customerEmail}
                                </span>
                              )}
                            </p>
                          )}
                        </div>

                        {/* Botón WhatsApp directo si tiene teléfono */}
                        {rawPhone && (
                          <div className="shrink-0">
                            <a
                              href={`https://wa.me/${rawPhone}?text=${encodeURIComponent(
                                `¡Hola ${customerName}! 🎉 Te escribimos desde el local para darte una gran noticia: ¡Sos el ganador/a del ${winner.prize_position}º Premio (${winner.prize_title}) en nuestro sorteo "${viewWinnersRaffle?.name}" con el boleto #${ticketNumber}! ¡Muchas felicitaciones!`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
                              title="Enviar mensaje de felicitación por WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>Avisar por WhatsApp</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Auditoría y Semilla Criptográfica */}
            {viewWinnersRaffle?.draw_seed && (
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60 mt-3">
                <div
                  className="flex items-center justify-between cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300"
                  onClick={() => setShowAuditDetails(!showAuditDetails)}
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Auditoría de Transparencia</span>
                  </span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    {showAuditDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </div>
                {showAuditDetails && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-[11px] text-slate-500">
                    <p>
                      El sorteo fue ejecutado de forma pseudoaleatoria determinística con semilla inmutable. Esto garantiza que el orden de ganadores no puede ser alterado ni repetido.
                    </p>
                    <div className="flex items-center justify-between bg-white dark:bg-slate-950 p-2 rounded-xl border font-mono text-[10px]">
                      <span className="truncate mr-2">Semilla: {viewWinnersRaffle.draw_seed}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => {
                          navigator.clipboard.writeText(viewWinnersRaffle.draw_seed || '')
                          toast.success('Semilla copiada al portapapeles')
                        }}
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200/80 dark:border-slate-800 flex flex-row items-center justify-between gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl text-xs font-semibold border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              onClick={handleCopyWinners}
              disabled={winnersData.length === 0}
            >
              {copiedWinners ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-amber-600" />
                  <span>Copiar para Redes</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              className="rounded-xl text-xs px-5 bg-slate-900 text-white dark:bg-white dark:text-slate-950"
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
            {/* Las plantillas son el camino principal: dejan el sorteo casi
                armado y después se corrige lo que haga falta. */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Empezá con un sorteo armado
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {RAFFLE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="flex flex-col items-start gap-1 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition-colors hover:border-cyan-500 hover:bg-cyan-50/60 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:bg-slate-800/80"
                  >
                    <span className="text-base">{tpl.icon}</span>
                    <span className="text-xs font-bold leading-tight text-slate-900 dark:text-slate-100">
                      {tpl.label}
                    </span>
                    <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                      {tpl.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Lo básico: sin esto no hay sorteo ── */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="raffle-name" className="text-sm font-semibold">
                  ¿Cómo se llama el sorteo? <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="raffle-name"
                  placeholder="Ej: Sorteo de aniversario"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="h-10 rounded-xl bg-white text-sm font-medium dark:bg-slate-950"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">¿Qué se sortea?</Label>
                {prizes.map((prize, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
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
                          ? 'Primer premio (ej: un celular)'
                          : `${index + 1}º premio (ej: un vale de compra)`
                      }
                      value={prize.title}
                      onChange={(e) =>
                        setPrizes((current) =>
                          current.map((p, i) => (i === index ? { ...p, title: e.target.value } : p))
                        )
                      }
                      className="h-9.5 rounded-xl bg-white text-xs font-medium dark:bg-slate-950"
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 w-full justify-center gap-1.5 rounded-xl border-dashed text-xs"
                  onClick={() => setPrizes((current) => [...current, { position: current.length + 1, title: '' }])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar otro premio
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="raffle-end" className="text-sm font-semibold">
                    ¿Hasta cuándo se participa?
                  </Label>
                  <Input
                    id="raffle-end"
                    type="datetime-local"
                    value={draft.ends_at}
                    onChange={(e) => setDraft((d) => ({ ...d, ends_at: e.target.value }))}
                    className="h-10 rounded-xl bg-white text-xs dark:bg-slate-950"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ese día se cierra y se puede sortear.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="raffle-cost" className="text-sm font-semibold">
                    ¿Cuántos puntos cuesta un número?
                  </Label>
                  <Input
                    id="raffle-cost"
                    type="number"
                    min={1}
                    value={draft.points_per_ticket}
                    onChange={(e) => setDraft((d) => ({ ...d, points_per_ticket: Number(e.target.value) }))}
                    className="h-10 rounded-xl bg-white text-xs font-semibold tabular-nums dark:bg-slate-950"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {explainSpending({ points_per_ticket: draft.points_per_ticket, name: draft.name }) ??
                      'El cliente canjea sus puntos por números.'}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Todo lo demás, plegado ── */}
            <details className="group rounded-xl border border-slate-200 dark:border-slate-800">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 [&::-webkit-details-marker]:hidden">
                <span>Opciones avanzadas</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  <span className="group-open:hidden">Ver ↓</span>
                  <span className="hidden group-open:inline">Ocultar ↑</span>
                </span>
              </summary>

              <div className="space-y-5 border-t border-slate-100 p-4 dark:border-slate-800">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="raffle-start" className="text-xs font-semibold">Desde cuándo</Label>
                    <Input
                      id="raffle-start"
                      type="datetime-local"
                      value={draft.starts_at}
                      onChange={(e) => setDraft((d) => ({ ...d, starts_at: e.target.value }))}
                      className="h-9.5 rounded-xl bg-white text-xs dark:bg-slate-950"
                    />
                    <p className="text-[11px] text-muted-foreground">Vacío: arranca ahora.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="raffle-per-customer" className="text-xs font-semibold">
                      Máximo de números por cliente
                    </Label>
                    <Input
                      id="raffle-per-customer"
                      type="number"
                      min={1}
                      placeholder="Sin límite"
                      value={draft.max_tickets_per_customer}
                      onChange={(e) => setDraft((d) => ({ ...d, max_tickets_per_customer: e.target.value }))}
                      className="h-9.5 rounded-xl bg-white text-xs tabular-nums dark:bg-slate-950"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="raffle-pool" className="text-xs font-semibold">
                      Cuántos números tiene el talonario
                    </Label>
                    <Input
                      id="raffle-pool"
                      type="number"
                      min={10}
                      step={50}
                      value={draft.max_tickets_total}
                      onChange={(e) => setDraft((d) => ({ ...d, max_tickets_total: Number(e.target.value) }))}
                      className="h-9.5 rounded-xl bg-white text-xs tabular-nums dark:bg-slate-950"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Del #1 al #{Number(draft.max_tickets_total || 1000).toLocaleString('es-PY')}, sin repetidos.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="raffle-age" className="text-xs font-semibold">Edad mínima</Label>
                    <Input
                      id="raffle-age"
                      type="number"
                      min={0}
                      max={99}
                      value={draft.min_age}
                      onChange={(e) => setDraft((d) => ({ ...d, min_age: Number(e.target.value) }))}
                      className="h-9.5 rounded-xl bg-white text-xs tabular-nums dark:bg-slate-950"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {Number(draft.min_age) > 0 ? `${draft.min_age}+ años` : '0 = sin restricción'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="raffle-requirements" className="text-xs font-semibold">
                    Condiciones, si querés aclarar alguna
                  </Label>
                  <Textarea
                    id="raffle-requirements"
                    rows={2}
                    placeholder="Ej: participan clientes con ficha y teléfono."
                    value={draft.requirements}
                    onChange={(e) => setDraft((d) => ({ ...d, requirements: e.target.value }))}
                    className="resize-none rounded-xl bg-white text-xs dark:bg-slate-950"
                  />
                </div>

                {/*
                  Este interruptor decía «Participación Directa por Compra» y
                  mostraba «cada Gs. 100.000 = +1 número». No es lo que hace:
                  `tryAutoRaffleEntryForSale` le **gasta los puntos** al cliente
                  al cerrar la venta, hasta cinco números. Acá se dice eso.
                */}
                <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Label htmlFor="auto-entry-switch" className="text-xs font-semibold">
                        Canjear los puntos solo, al cobrar
                      </Label>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Cuando la compra llega al monto de abajo, el sistema le canjea al cliente
                        los puntos que tenga por números (hasta 5), sin preguntarle.
                      </p>
                    </div>
                    <Switch
                      id="auto-entry-switch"
                      checked={draft.auto_entry_on_sale}
                      onCheckedChange={(checked) => setDraft((d) => ({ ...d, auto_entry_on_sale: checked }))}
                    />
                  </div>

                  {draft.auto_entry_on_sale && (
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="min-purchase" className="text-xs font-semibold">
                        Desde qué monto de compra
                      </Label>
                      <Input
                        id="min-purchase"
                        type="number"
                        min={1000}
                        step={10000}
                        value={draft.min_purchase_amount}
                        onChange={(e) => setDraft((d) => ({ ...d, min_purchase_amount: Number(e.target.value) }))}
                        className="h-9.5 rounded-xl bg-white text-xs font-semibold tabular-nums dark:bg-slate-950"
                      />
                    </div>
                  )}
                </div>

                {/*
                  Vender puntos en efectivo es vender números de sorteo por
                  plata. Se puede, pero es una decisión del negocio: viene
                  apagado y dice de frente lo que significa.
                */}
                <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Label htmlFor="point-purchase-switch" className="text-xs font-semibold">
                        Vender puntos en caja
                      </Label>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        El cliente paga y recibe puntos sin comprar nada más: en los hechos, le
                        vendés números del sorteo.
                      </p>
                    </div>
                    <Switch
                      id="point-purchase-switch"
                      checked={draft.allow_point_purchase}
                      onCheckedChange={(checked) => setDraft((d) => ({ ...d, allow_point_purchase: checked }))}
                    />
                  </div>

                  {draft.allow_point_purchase && (
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="point-price" className="text-xs font-semibold">
                        Precio de cada punto
                      </Label>
                      <Input
                        id="point-price"
                        type="number"
                        min={100}
                        step={100}
                        value={draft.point_purchase_price}
                        onChange={(e) => setDraft((d) => ({ ...d, point_purchase_price: Number(e.target.value) }))}
                        className="h-9.5 rounded-xl bg-white text-xs font-semibold tabular-nums dark:bg-slate-950"
                      />
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        Un número le sale{' '}
                        {formatCurrency(
                          (Number(draft.point_purchase_price) || 0) * (Number(draft.points_per_ticket) || 0),
                        )}
                        .
                      </p>
                    </div>
                  )}
                </div>

                {Number(draft.min_age) > 0 && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                      {responsiblePlayNotice({ minAge: Number(draft.min_age) })}
                    </p>
                  </div>
                )}
              </div>
            </details>
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

      {/* ── MODAL: CONFIRMAR CIERRE ───────────────────────────────────── */}
      <AlertDialog open={!!confirmClose} onOpenChange={(value) => !value && setConfirmClose(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              ¿Cerrar «{confirmClose?.name}»?
            </AlertDialogTitle>
            <AlertDialogDescription asChild className="text-xs">
              <div className="space-y-2">
                <p>
                  Nadie va a poder canjear más números, y un sorteo cerrado{' '}
                  <strong>no se puede volver a abrir</strong>.
                </p>
                {confirmClose && ticketCount(confirmClose) === 0 && (
                  <p className="font-semibold text-rose-600 dark:text-rose-400">
                    Todavía no canjeó nadie: si lo cerrás ahora, este sorteo queda sin uso.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs">Mejor no</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl text-xs"
              onClick={() => {
                if (confirmClose) void onUpdateStatus(confirmClose.id, 'closed')
                setConfirmClose(null)
              }}
            >
              Cerrar el sorteo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── MODAL: CONFIRMAR SORTEO ───────────────────────────────────── */}
      <AlertDialog open={!!confirmDraw} onOpenChange={(value) => !value && setConfirmDraw(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              ¿Realizar Sorteo &laquo;{confirmDraw?.name}&raquo;?
            </AlertDialogTitle>
            {/* `asChild`: la descripción de Radix es un <p>, y un <p> no puede
                contener otro. Sin esto, React avisa al hidratar. */}
            <AlertDialogDescription asChild className="text-xs">
              <div className="space-y-2">
                <p>
                  Se seleccionará al azar <strong>1 ganador único por cada premio</strong> entre los{' '}
                  <strong>{confirmDraw ? ticketCount(confirmDraw) : 0} números canjeados</strong>.
                </p>
                <p className="font-semibold text-rose-600 dark:text-rose-400">
                  Esta acción es definitiva: se ejecuta una sola vez y no se puede revertir ni repetir.
                </p>
              </div>
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
