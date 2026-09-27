'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalendarClock, Loader2, Plus, Trash2, Zap } from 'lucide-react'
import type { PointRuleRow } from '@/hooks/use-loyalty'

interface PointRulesCardProps {
  rules: PointRuleRow[]
  onCreate: (values: Record<string, unknown>) => Promise<boolean>
  onToggle: (id: string, isActive: boolean) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  canManage: boolean
}

const EMPTY_RULE = {
  name: '',
  description: '',
  kind: 'multiplier' as 'multiplier' | 'bonus_per_purchase',
  multiplier: 2,
  bonus_points: 0,
  starts_at: '',
  ends_at: '',
  max_bonus_points_per_customer: '',
  max_bonus_points_total: '',
  min_purchase_amount: '',
}

function formatRange(rule: PointRuleRow) {
  const from = new Date(rule.starts_at).toLocaleDateString('es-PY')
  const to = new Date(rule.ends_at).toLocaleDateString('es-PY')
  return `${from} → ${to}`
}

function ruleState(rule: PointRuleRow, now: Date) {
  if (!rule.is_active) return { label: 'Apagada', variant: 'secondary' as const }
  if (now < new Date(rule.starts_at)) return { label: 'Programada', variant: 'outline' as const }
  if (now >= new Date(rule.ends_at)) return { label: 'Terminada', variant: 'secondary' as const }
  return { label: 'En curso', variant: 'default' as const }
}

export function PointRulesCard({ rules, onCreate, onToggle, onDelete, canManage }: PointRulesCardProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(EMPTY_RULE)
  const now = new Date()

  const handleCreate = async () => {
    setSaving(true)
    const ok = await onCreate({
      name: draft.name,
      description: draft.description || null,
      kind: draft.kind,
      multiplier: Number(draft.multiplier) || 1,
      bonus_points: Number(draft.bonus_points) || 0,
      starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : '',
      ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : '',
      max_bonus_points_per_customer: draft.max_bonus_points_per_customer
        ? Number(draft.max_bonus_points_per_customer)
        : null,
      max_bonus_points_total: draft.max_bonus_points_total ? Number(draft.max_bonus_points_total) : null,
      min_purchase_amount: draft.min_purchase_amount ? Number(draft.min_purchase_amount) : null,
      is_active: true,
    })
    setSaving(false)

    if (ok) {
      setDraft(EMPTY_RULE)
      setOpen(false)
    }
  }

  const applyPreset = (preset: 'x2' | 'x3' | 'bonus100') => {
    const today = new Date()
    const nextWeek = new Date()
    nextWeek.setDate(today.getDate() + 7)

    const formatDt = (d: Date) => d.toISOString().slice(0, 16)

    if (preset === 'x2') {
      setDraft({
        ...EMPTY_RULE,
        name: 'Doble Puntos en Todas las Compras (x2)',
        kind: 'multiplier',
        multiplier: 2,
        starts_at: formatDt(today),
        ends_at: formatDt(nextWeek),
      })
    } else if (preset === 'x3') {
      setDraft({
        ...EMPTY_RULE,
        name: 'Triple Puntos Fin de Semana (x3)',
        kind: 'multiplier',
        multiplier: 3,
        starts_at: formatDt(today),
        ends_at: formatDt(nextWeek),
      })
    } else if (preset === 'bonus100') {
      setDraft({
        ...EMPTY_RULE,
        name: 'Bono +100 Puntos por Compras Mayores',
        kind: 'bonus_per_purchase',
        bonus_points: 100,
        min_purchase_amount: '200000',
        starts_at: formatDt(today),
        ends_at: formatDt(nextWeek),
      })
    }
  }

  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-xs dark:border-slate-800">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
                Multiplicadores y Campañas Temporales
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Otorga puntos extra (ej: 2x o 3x) durante fechas especiales o compras mayores. Se aplican automáticamente en caja.
              </CardDescription>
            </div>
          </div>
          {canManage && (
            <Button
              size="sm"
              className="gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs h-9 px-4 shadow-md shadow-cyan-600/20"
              onClick={() => setOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Nueva Campaña de Puntos
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-5">
        {rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 mx-auto">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                No hay campañas temporales de puntos activas
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                Crea campañas como &laquo;Doble Puntos de Fin de Semana&raquo; o &laquo;+100 Puntos de Regalo&raquo; para incentivar mayores ventas en caja.
              </p>
            </div>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-xs font-semibold gap-1.5"
                onClick={() => {
                  applyPreset('x2')
                  setOpen(true)
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Crear campaña rápida (Doble Puntos)
              </Button>
            )}
          </div>
        ) : (
          rules.map((rule) => {
            const state = ruleState(rule, now)
            const cap = rule.max_bonus_points_total
            const usedPercent = cap ? Math.min(100, (rule.awarded_bonus_points / cap) * 100) : null

            return (
              <div
                key={rule.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {rule.name}
                      </p>
                      <Badge variant={state.variant} className="text-[10px] font-bold">
                        {state.label}
                      </Badge>
                      <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-extrabold text-[10px]">
                        {rule.kind === 'multiplier' ? `x${rule.multiplier} Puntos` : `+${rule.bonus_points} pts de regalo`}
                      </Badge>
                    </div>

                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                      Vigencia: <strong className="text-slate-800 dark:text-slate-200">{formatRange(rule)}</strong>
                      {rule.min_purchase_amount ? ` · Compra mínima: Gs. ${Number(rule.min_purchase_amount).toLocaleString('es-PY')}` : ''}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch
                        checked={rule.is_active}
                        aria-label={`Activar ${rule.name}`}
                        onCheckedChange={(value) => onToggle(rule.id, value)}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        aria-label={`Eliminar ${rule.name}`}
                        onClick={() => onDelete(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {usedPercent !== null && (
                  <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Presupuesto de puntos entregado:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {rule.awarded_bonus_points} / {cap} pts ({usedPercent.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={usedPercent} className="h-1.5" />
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-indigo-600">
              <Zap className="h-5 w-5" />
              <DialogTitle className="text-base sm:text-lg font-bold">
                Nueva Campaña de Puntos
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Configura multiplicadores temporales o bonos de puntos en fechas comerciales especiales.
            </DialogDescription>
          </DialogHeader>

          {/* Plantillas rápidas */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-[11px] font-bold uppercase text-slate-400">Plantillas Rápidas:</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl text-[11px] h-7 px-2.5 font-semibold"
                onClick={() => applyPreset('x2')}
              >
                🚀 Doble Puntos (x2)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl text-[11px] h-7 px-2.5 font-semibold"
                onClick={() => applyPreset('x3')}
              >
                🌟 Triple Puntos (x3)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl text-[11px] h-7 px-2.5 font-semibold"
                onClick={() => applyPreset('bonus100')}
              >
                🎁 Bono +100 Puntos
              </Button>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name" className="text-xs font-semibold">
                Nombre de la Campaña
              </Label>
              <Input
                id="rule-name"
                placeholder="Ej: Doble puntos de fin de semana"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="rounded-xl text-xs h-9.5 font-medium"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rule-kind" className="text-xs font-semibold">Tipo de Bonificación</Label>
                <Select
                  value={draft.kind}
                  onValueChange={(value) => setDraft((d) => ({ ...d, kind: value as typeof d.kind }))}
                >
                  <SelectTrigger id="rule-kind" className="rounded-xl text-xs h-9.5"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="multiplier">Multiplicador (ej: x2, x3)</SelectItem>
                    <SelectItem value="bonus_per_purchase">Puntos fijos de regalo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {draft.kind === 'multiplier' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="rule-multiplier" className="text-xs font-semibold">Multiplicador</Label>
                  <Input
                    id="rule-multiplier"
                    type="number"
                    min={1}
                    step={0.5}
                    value={draft.multiplier}
                    onChange={(e) => setDraft((d) => ({ ...d, multiplier: Number(e.target.value) }))}
                    className="rounded-xl text-xs h-9.5 font-bold"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="rule-bonus" className="text-xs font-semibold">Puntos de Regalo</Label>
                  <Input
                    id="rule-bonus"
                    type="number"
                    min={0}
                    value={draft.bonus_points}
                    onChange={(e) => setDraft((d) => ({ ...d, bonus_points: Number(e.target.value) }))}
                    className="rounded-xl text-xs h-9.5 font-bold"
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rule-start" className="text-xs font-semibold">Fecha y Hora de Inicio</Label>
                <Input
                  id="rule-start"
                  type="datetime-local"
                  value={draft.starts_at}
                  onChange={(e) => setDraft((d) => ({ ...d, starts_at: e.target.value }))}
                  className="rounded-xl text-xs h-9.5"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-end" className="text-xs font-semibold">Fecha y Hora de Cierre</Label>
                <Input
                  id="rule-end"
                  type="datetime-local"
                  value={draft.ends_at}
                  onChange={(e) => setDraft((d) => ({ ...d, ends_at: e.target.value }))}
                  className="rounded-xl text-xs h-9.5"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="rule-min" className="text-xs font-semibold">Compra Mínima</Label>
                <Input
                  id="rule-min"
                  type="number"
                  min={0}
                  step={10000}
                  placeholder="Sin mínimo"
                  value={draft.min_purchase_amount}
                  onChange={(e) => setDraft((d) => ({ ...d, min_purchase_amount: e.target.value }))}
                  className="rounded-xl text-xs h-9.5"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-cap-customer" className="text-xs font-semibold">Tope / Cliente</Label>
                <Input
                  id="rule-cap-customer"
                  type="number"
                  min={1}
                  placeholder="Sin tope"
                  value={draft.max_bonus_points_per_customer}
                  onChange={(e) => setDraft((d) => ({ ...d, max_bonus_points_per_customer: e.target.value }))}
                  className="rounded-xl text-xs h-9.5"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-cap-total" className="text-xs font-semibold">Tope Total Campaña</Label>
                <Input
                  id="rule-cap-total"
                  type="number"
                  min={1}
                  placeholder="Sin tope"
                  value={draft.max_bonus_points_total}
                  onChange={(e) => setDraft((d) => ({ ...d, max_bonus_points_total: e.target.value }))}
                  className="rounded-xl text-xs h-9.5"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" className="rounded-xl text-xs h-9 px-4" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !draft.name.trim()}
              className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs h-9 px-5 shadow-md shadow-cyan-600/20"
            >
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Crear Campaña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
