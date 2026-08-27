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

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-indigo-500" />
              Promociones temporales de puntos
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Puntos extra durante un período. Si hay varias vigentes se aplica una sola: la que más le conviene al cliente.
            </CardDescription>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nueva
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {rules.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-xs text-slate-500">
            No hay promociones de puntos. Sirven para campañas como &laquo;doble puntos el fin de semana&raquo;.
          </p>
        ) : (
          rules.map((rule) => {
            const state = ruleState(rule, now)
            const cap = rule.max_bonus_points_total
            const usedPercent = cap ? Math.min(100, (rule.awarded_bonus_points / cap) * 100) : null

            return (
              <div key={rule.id} className="rounded-xl border p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{rule.name}</p>
                      <Badge variant={state.variant} className="text-[10px]">{state.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {rule.kind === 'multiplier' ? `x${rule.multiplier}` : `+${rule.bonus_points} pts`}
                      </Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <CalendarClock className="h-3 w-3" />
                      {formatRange(rule)}
                      {rule.min_purchase_amount ? ` · desde ${rule.min_purchase_amount}` : ''}
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
                        className="h-7 w-7 text-red-500 hover:text-red-600"
                        aria-label={`Eliminar ${rule.name}`}
                        onClick={() => onDelete(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {usedPercent !== null && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Bonificación entregada</span>
                      <span>{rule.awarded_bonus_points} / {cap} pts</span>
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
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Nueva promoción de puntos</DialogTitle>
            <DialogDescription className="text-xs">
              Durante este período las compras suman más. Los topes evitan que una campaña se descontrole.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name" className="text-xs">Nombre</Label>
              <Input
                id="rule-name"
                placeholder="Doble puntos de fin de semana"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rule-kind" className="text-xs">Tipo</Label>
                <Select
                  value={draft.kind}
                  onValueChange={(value) => setDraft((d) => ({ ...d, kind: value as typeof d.kind }))}
                >
                  <SelectTrigger id="rule-kind"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiplier">Multiplicador</SelectItem>
                    <SelectItem value="bonus_per_purchase">Puntos fijos por compra</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {draft.kind === 'multiplier' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="rule-multiplier" className="text-xs">Multiplicador</Label>
                  <Input
                    id="rule-multiplier"
                    type="number"
                    min={1}
                    step={0.5}
                    value={draft.multiplier}
                    onChange={(e) => setDraft((d) => ({ ...d, multiplier: Number(e.target.value) }))}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="rule-bonus" className="text-xs">Puntos extra</Label>
                  <Input
                    id="rule-bonus"
                    type="number"
                    min={0}
                    value={draft.bonus_points}
                    onChange={(e) => setDraft((d) => ({ ...d, bonus_points: Number(e.target.value) }))}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rule-start" className="text-xs">Desde</Label>
                <Input
                  id="rule-start"
                  type="datetime-local"
                  value={draft.starts_at}
                  onChange={(e) => setDraft((d) => ({ ...d, starts_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-end" className="text-xs">Hasta</Label>
                <Input
                  id="rule-end"
                  type="datetime-local"
                  value={draft.ends_at}
                  onChange={(e) => setDraft((d) => ({ ...d, ends_at: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="rule-min" className="text-xs">Compra mínima</Label>
                <Input
                  id="rule-min"
                  type="number"
                  min={0}
                  placeholder="Sin mínimo"
                  value={draft.min_purchase_amount}
                  onChange={(e) => setDraft((d) => ({ ...d, min_purchase_amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-cap-customer" className="text-xs">Tope por cliente</Label>
                <Input
                  id="rule-cap-customer"
                  type="number"
                  min={1}
                  placeholder="Sin tope"
                  value={draft.max_bonus_points_per_customer}
                  onChange={(e) => setDraft((d) => ({ ...d, max_bonus_points_per_customer: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-cap-total" className="text-xs">Tope total</Label>
                <Input
                  id="rule-cap-total"
                  type="number"
                  min={1}
                  placeholder="Sin tope"
                  value={draft.max_bonus_points_total}
                  onChange={(e) => setDraft((d) => ({ ...d, max_bonus_points_total: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Crear promoción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
