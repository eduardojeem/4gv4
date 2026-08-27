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
import { Coins, Gift, Loader2, Plus, ShieldAlert, Ticket, Trophy, Users, X } from 'lucide-react'
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

const STATUS_LABEL: Record<RaffleRow['status'], { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Borrador', variant: 'secondary' },
  published: { label: 'Abierto', variant: 'default' },
  closed: { label: 'Cerrado', variant: 'outline' },
  completed: { label: 'Sorteado', variant: 'outline' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
}

const EMPTY_RAFFLE = {
  name: '',
  description: '',
  requirements: '',
  terms: '',
  starts_at: '',
  ends_at: '',
  points_per_ticket: 50,
  max_tickets_per_customer: '',
  max_tickets_total: 1000,
  min_age: 18,
}

function ticketCount(raffle: RaffleRow) {
  return raffle.tickets?.[0]?.count ?? 0
}

export function RafflesManager({ raffles, onCreate, onUpdateStatus, onDraw, onRefresh, canManage }: RafflesManagerProps) {
  const [redeemFor, setRedeemFor] = useState<RaffleRow | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [drawing, setDrawing] = useState<string | null>(null)
  const [confirmDraw, setConfirmDraw] = useState<RaffleRow | null>(null)
  const [draft, setDraft] = useState(EMPTY_RAFFLE)
  const [prizes, setPrizes] = useState<Array<{ position: number; title: string }>>([
    { position: 1, title: '' },
  ])

  const handleCreate = async () => {
    setSaving(true)
    const ok = await onCreate({
      name: draft.name,
      description: draft.description || null,
      requirements: draft.requirements || null,
      terms: draft.terms || null,
      prizes: prizes.filter((p) => p.title.trim()).map((p, i) => ({ position: i + 1, title: p.title.trim() })),
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
    setDrawing(confirmDraw.id)
    await onDraw(confirmDraw.id)
    setDrawing(null)
    setConfirmDraw(null)
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-4 w-4 text-rose-500" />
              Sorteos
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              El cliente canjea puntos por números. Los números salen al azar y el sorteo se corre una sola vez.
            </CardDescription>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nuevo sorteo
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {raffles.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-xs text-slate-500">
            Todavía no hay sorteos. Creá uno, cargá los premios y publicalo para que el mostrador pueda vender números.
          </p>
        ) : (
          raffles.map((raffle) => {
            const status = STATUS_LABEL[raffle.status]
            const issued = ticketCount(raffle)
            const ended = new Date(raffle.ends_at) <= new Date()

            return (
              <div key={raffle.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{raffle.name}</p>
                      <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Ticket className="h-3 w-3" />
                        {raffle.points_per_ticket} pts por número
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {issued} / {raffle.max_tickets_total} vendidos
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        {raffle.prizes?.length ?? 0} premio(s)
                      </span>
                      <span>Cierra el {new Date(raffle.ends_at).toLocaleDateString('es-PY')}</span>
                    </div>
                    {raffle.status === 'completed' && raffle.draw_seed && (
                      <p className="mt-2 font-mono text-[10px] text-slate-400">
                        Semilla del sorteo: {raffle.draw_seed}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {/* Canjear no requiere permiso de gestion: lo hace quien
                        atiende el mostrador. La base valida el resto. */}
                    {raffle.status === 'published' && !ended && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRedeemFor(raffle)}>
                        <Coins className="h-3.5 w-3.5" />
                        Canjear números
                      </Button>
                    )}
                    {canManage && (
                      <>
                      {raffle.status === 'draft' && (
                        <Button size="sm" variant="outline" onClick={() => onUpdateStatus(raffle.id, 'published')}>
                          Publicar
                        </Button>
                      )}
                      {raffle.status === 'published' && (
                        <Button size="sm" variant="outline" onClick={() => onUpdateStatus(raffle.id, 'closed')}>
                          Cerrar
                        </Button>
                      )}
                      {(raffle.status === 'closed' || (raffle.status === 'published' && ended)) && (
                        <Button size="sm" onClick={() => setConfirmDraw(raffle)} disabled={drawing === raffle.id}>
                          {drawing === raffle.id && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                          Sortear
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

      {/* ── Crear sorteo ──────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Nuevo sorteo</DialogTitle>
            <DialogDescription className="text-xs">
              Se crea como borrador. Revisalo y publicalo cuando esté listo para recibir participantes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="raffle-name" className="text-xs">Nombre</Label>
              <Input
                id="raffle-name"
                placeholder="Sorteo aniversario"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Premios</Label>
              {prizes.map((prize, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-xs font-bold text-slate-400">{index + 1}º</span>
                  <Input
                    placeholder={index === 0 ? 'Celular' : 'Otro premio'}
                    value={prize.title}
                    onChange={(e) =>
                      setPrizes((current) =>
                        current.map((p, i) => (i === index ? { ...p, title: e.target.value } : p))
                      )
                    }
                  />
                  {prizes.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      aria-label={`Quitar premio ${index + 1}`}
                      onClick={() => setPrizes((current) => current.filter((_, i) => i !== index))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs"
                onClick={() => setPrizes((current) => [...current, { position: current.length + 1, title: '' }])}
              >
                <Plus className="h-3 w-3" />
                Agregar premio
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="raffle-start" className="text-xs">Desde</Label>
                <Input
                  id="raffle-start"
                  type="datetime-local"
                  value={draft.starts_at}
                  onChange={(e) => setDraft((d) => ({ ...d, starts_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="raffle-end" className="text-xs">Hasta</Label>
                <Input
                  id="raffle-end"
                  type="datetime-local"
                  value={draft.ends_at}
                  onChange={(e) => setDraft((d) => ({ ...d, ends_at: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="raffle-cost" className="text-xs">Puntos por número</Label>
                <Input
                  id="raffle-cost"
                  type="number"
                  min={1}
                  value={draft.points_per_ticket}
                  onChange={(e) => setDraft((d) => ({ ...d, points_per_ticket: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="raffle-per-customer" className="text-xs">Máx. por cliente</Label>
                <Input
                  id="raffle-per-customer"
                  type="number"
                  min={1}
                  placeholder="Sin tope"
                  value={draft.max_tickets_per_customer}
                  onChange={(e) => setDraft((d) => ({ ...d, max_tickets_per_customer: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="raffle-pool" className="text-xs">Números totales</Label>
                <Input
                  id="raffle-pool"
                  type="number"
                  min={1}
                  value={draft.max_tickets_total}
                  onChange={(e) => setDraft((d) => ({ ...d, max_tickets_total: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="raffle-age" className="text-xs">Edad mínima</Label>
                <Input
                  id="raffle-age"
                  type="number"
                  min={0}
                  max={99}
                  value={draft.min_age}
                  onChange={(e) => setDraft((d) => ({ ...d, min_age: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="raffle-requirements" className="text-xs">Requisitos de participación</Label>
              <Textarea
                id="raffle-requirements"
                rows={2}
                placeholder="Ser cliente registrado y tener al menos 50 puntos."
                value={draft.requirements}
                onChange={(e) => setDraft((d) => ({ ...d, requirements: e.target.value }))}
              />
            </div>

            {/* El aviso se arma solo con la edad cargada: no depende de que
                alguien se acuerde de escribirlo en cada sorteo. */}
            <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                {responsiblePlayNotice({ minAge: Number(draft.min_age) || 18 })}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Crear sorteo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RaffleRedeemDialog
        raffle={redeemFor}
        onOpenChange={(open) => !open && setRedeemFor(null)}
        onRedeemed={onRefresh}
      />

      {/* ── Confirmar sorteo ──────────────────────────────────────────── */}
      <AlertDialog open={!!confirmDraw} onOpenChange={(value) => !value && setConfirmDraw(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Sortear &laquo;{confirmDraw?.name}&raquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elige un ganador por premio entre los {confirmDraw ? ticketCount(confirmDraw) : 0} números vendidos.
              <strong> Esto se hace una sola vez y no se puede repetir.</strong> La semilla usada queda guardada para
              que cualquiera pueda verificar el resultado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDraw}>Sortear ahora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
