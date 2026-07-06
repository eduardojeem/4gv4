'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Wallet, Pencil, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'
import { type CompensationConfig, type EarningsResult } from '@/lib/technician/earnings'

interface Props {
  technicianId: string
  canManage: boolean
  compensation: CompensationConfig
  earnings: EarningsResult | null
  isLoading: boolean
  onSaved: () => void
}

const BASE_LABEL: Record<CompensationConfig['commission_base'], string> = {
  labor: 'Mano de obra',
  final: 'Total',
}

export function TechnicianCompensationCard({ technicianId, canManage, compensation, earnings, isLoading, onSaved }: Props) {
  const { selectedBranchId } = useBranch()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<CompensationConfig>(compensation)

  // Sincronizar el form cuando llega/actualiza la config.
  useEffect(() => {
    if (!isEditing) setForm(compensation)
  }, [compensation, isEditing])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/repairs/technicians/${technicianId}/compensation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...branchHeaders(selectedBranchId) },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }
      toast.success('Compensación actualizada')
      setIsEditing(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />
  }

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-emerald-500" />
          Compensación
          <span className="text-xs font-normal text-muted-foreground">· este mes</span>
        </CardTitle>
        {canManage && !isEditing && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditing ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Sueldo base" value={formatCurrency(earnings?.base ?? 0)} />
              <Metric label="Comisión" value={formatCurrency(earnings?.commission ?? 0)} />
              <Metric label="Por reparación" value={formatCurrency(earnings?.fixed ?? 0)} />
              <Metric label="Total" value={formatCurrency(earnings?.total ?? 0)} highlight />
            </div>
            <div className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
              {compensation.base_salary === 0 &&
              compensation.commission_rate === 0 &&
              compensation.fixed_per_repair === 0 ? (
                <span>Sin compensación configurada para este técnico.</span>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>Sueldo base: <strong className="text-foreground">{formatCurrency(compensation.base_salary)}</strong>/mes</span>
                  <span>Comisión: <strong className="text-foreground">{compensation.commission_rate}%</strong> sobre {BASE_LABEL[compensation.commission_base]}</span>
                  <span>Fijo/reparación: <strong className="text-foreground">{formatCurrency(compensation.fixed_per_repair)}</strong></span>
                  <span>Devenga al pasar a: <strong className="text-foreground">{compensation.accrual_status}</strong> ({earnings?.repairsCount ?? 0} reparaciones)</span>
                  {compensation.salary_effective_from && (
                    <span>Sueldo vigente desde: <strong className="text-foreground">{compensation.salary_effective_from}</strong></span>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sueldo base mensual (Gs.)">
                <Input type="number" min={0} value={form.base_salary}
                  onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} />
              </Field>
              <Field label="Fijo por reparación (Gs.)">
                <Input type="number" min={0} value={form.fixed_per_repair}
                  onChange={(e) => setForm({ ...form, fixed_per_repair: Number(e.target.value) })} />
              </Field>
              <Field label="Comisión (%)">
                <Input type="number" min={0} max={100} step="0.01" value={form.commission_rate}
                  onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) })} />
              </Field>
              <Field label="Comisión sobre">
                <Select value={form.commission_base}
                  onValueChange={(v) => setForm({ ...form, commission_base: v as CompensationConfig['commission_base'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="labor">Mano de obra (labor)</SelectItem>
                    <SelectItem value="final">Total de la reparación</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Devengar comisión al pasar a">
                <Select value={form.accrual_status}
                  onValueChange={(v) => setForm({ ...form, accrual_status: v as CompensationConfig['accrual_status'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entregado">Entregado</SelectItem>
                    <SelectItem value="listo">Listo</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Sueldo vigente desde (opcional)">
                <Input type="date" value={form.salary_effective_from ?? ''}
                  onChange={(e) => setForm({ ...form, salary_effective_from: e.target.value || null })} />
              </Field>
            </div>
            <p className="text-[11px] text-muted-foreground">
              El sueldo base se prorratea el primer mes según esta fecha. Vacío = mes completo.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={isSaving}
                onClick={() => { setForm(compensation); setIsEditing(false) }}>
                <X className="mr-1.5 h-3.5 w-3.5" /> Cancelar
              </Button>
              <Button size="sm" disabled={isSaving} onClick={handleSave} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {isSaving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-border/60'}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${highlight ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
