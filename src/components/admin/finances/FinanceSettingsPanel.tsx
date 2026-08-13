'use client'

import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

type Employee = { user_id: string; role: string }
type Rule = {
  id: string
  scope_type: string
  employee_id: string | null
  role: string | null
  branch_id: string | null
  source_type: string
  source_reference_id: string | null
  accrual_status: 'listo' | 'entregado' | null
  calculation_type: string
  value: number
  status: 'draft' | 'approved' | 'retired'
  effective_from: string
  effective_to: string | null
}
type SourceType = 'sale' | 'repair' | 'repair_labor'
type RuleStatus = 'draft' | 'approved'

const statusLabel = {
  draft: 'Borrador',
  approved: 'Aprobada',
  retired: 'Retirada',
} as const

export function FinanceSettingsPanel({ organizationId, branchId }: {
  organizationId: string
  branchId: string | null | undefined
}) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [scopeType, setScopeType] = useState<'employee' | 'role'>('employee')
  const [sourceType, setSourceType] = useState<SourceType>('sale')
  const [accrualStatus, setAccrualStatus] = useState<'listo' | 'entregado'>('listo')

  const load = useCallback(async () => {
    const params = new URLSearchParams({ organizationId })
    if (branchId) params.set('branchId', branchId)
    const [employeeResponse, ruleResponse] = await Promise.all([
      fetch(`/api/admin/finances/employees?organizationId=${organizationId}`),
      fetch(`/api/admin/finances/commission-rules?${params.toString()}`),
    ])
    const ep = await employeeResponse.json().catch(() => null) as { employees?: Employee[]; error?: string } | null
    const rp = await ruleResponse.json().catch(() => null) as { rules?: Rule[]; error?: string } | null
    if (!employeeResponse.ok || !ruleResponse.ok) {
      setError(ep?.error ?? rp?.error ?? 'No se pudo cargar la configuración.')
      return
    }
    setError(null)
    setEmployees(ep?.employees ?? [])
    setRules(rp?.rules ?? [])
  }, [branchId, organizationId])

  // This effect synchronizes the local list with the selected finance scope.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  async function submit(form: FormData) {
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    const selectedScopeType = String(form.get('scopeType'))
    const status: RuleStatus = form.get('status') === 'approved' ? 'approved' : 'draft'
    const response = await fetch(`/api/admin/finances/commission-rules?organizationId=${organizationId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        branchId: branchId ?? undefined,
        scopeType: selectedScopeType,
        employeeId: selectedScopeType === 'employee' ? form.get('employeeId') : undefined,
        role: selectedScopeType === 'role' ? form.get('role') : undefined,
        sourceType,
        accrualStatus: sourceType === 'repair' || sourceType === 'repair_labor' ? accrualStatus : undefined,
        calculationType: form.get('calculationType'),
        value: Number(form.get('value')),
        status,
        effectiveFrom: form.get('effectiveFrom'),
      }),
    })
    const payload = await response.json().catch(() => null) as { error?: string } | null
    setIsSaving(false)
    if (!response.ok) {
      setError(payload?.error ?? 'No se pudo guardar la regla.')
      return
    }
    await load()
  }

  async function approveRule(rule: Rule) {
    if (approvingId) return
    setApprovingId(rule.id)
    setError(null)
    const response = await fetch(`/api/admin/finances/commission-rules?organizationId=${organizationId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: rule.id,
        branchId: rule.branch_id ?? undefined,
        scopeType: rule.scope_type,
        employeeId: rule.scope_type === 'employee' ? rule.employee_id ?? undefined : undefined,
        role: rule.scope_type === 'role' ? rule.role ?? undefined : undefined,
        sourceType: rule.source_type,
        sourceReferenceId: rule.source_reference_id ?? undefined,
        accrualStatus: rule.accrual_status ?? undefined,
        calculationType: rule.calculation_type,
        value: Number(rule.value),
        status: 'approved',
        effectiveFrom: rule.effective_from,
        effectiveTo: rule.effective_to ?? undefined,
      }),
    })
    const payload = await response.json().catch(() => null) as { error?: string } | null
    setApprovingId(null)
    if (!response.ok) {
      setError(payload?.error ?? 'No se pudo aprobar la regla.')
      return
    }
    await load()
  }

  const needsAccrualStatus = sourceType === 'repair' || sourceType === 'repair_labor'

  return <section className="space-y-4 rounded-lg border p-4">
    <div>
      <h2 className="font-semibold">Configuración de comisiones</h2>
      <p className="text-sm text-muted-foreground">Las excepciones individuales del empleado prevalecen sobre las reglas de rol. Solo las reglas aprobadas se aplican a la nómina.</p>
    </div>
    <form action={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-medium">Alcance<select name="scopeType" value={scopeType} onChange={(event) => setScopeType(event.target.value as 'employee' | 'role')} className="rounded-md border bg-background px-3 py-2"><option value="employee">Empleado</option><option value="role">Rol</option></select></label>
      {scopeType === 'employee' ? <label className="grid gap-1 text-sm font-medium">Empleado<select name="employeeId" required className="rounded-md border bg-background px-3 py-2"><option value="">Selecciona</option>{employees.map((employee) => <option key={employee.user_id} value={employee.user_id}>{employee.user_id}</option>)}</select></label> : <label className="grid gap-1 text-sm font-medium">Rol<select name="role" required className="rounded-md border bg-background px-3 py-2"><option value="">Selecciona</option>{['owner', 'admin', 'manager', 'cashier', 'technician', 'seller'].map((role) => <option key={role} value={role}>{role}</option>)}</select></label>}
      <label className="grid gap-1 text-sm font-medium">Origen<select aria-label="Origen" value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceType)} className="rounded-md border bg-background px-3 py-2"><option value="sale">Venta</option><option value="repair">Reparación</option><option value="repair_labor">Mano de obra</option></select></label>
      {needsAccrualStatus ? <label className="grid gap-1 text-sm font-medium">Estado de devengo<select aria-label="Estado de devengo" value={accrualStatus} onChange={(event) => setAccrualStatus(event.target.value as 'listo' | 'entregado')} className="rounded-md border bg-background px-3 py-2"><option value="listo">Listo</option><option value="entregado">Entregado</option></select></label> : null}
      <label className="grid gap-1 text-sm font-medium">Cálculo<select name="calculationType" className="rounded-md border bg-background px-3 py-2"><option value="percentage">Porcentaje</option><option value="fixed">Monto fijo</option></select></label>
      <label className="grid gap-1 text-sm font-medium">Valor<input name="value" type="number" min="0" step="0.01" required className="rounded-md border bg-background px-3 py-2" /></label>
      <label className="grid gap-1 text-sm font-medium">Vigente desde<input name="effectiveFrom" type="date" required className="rounded-md border bg-background px-3 py-2" /></label>
      {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" name="status" value="draft" variant="outline" disabled={isSaving}>Guardar borrador</Button>
        <Button type="submit" name="status" value="approved" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Crear y aprobar regla'}</Button>
      </div>
    </form>
    <ul className="divide-y text-sm">{rules.map((rule) => <li key={rule.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"><div>{rule.scope_type === 'employee' ? `Empleado ${rule.employee_id}` : `Rol ${rule.role}`} · {rule.source_type} · {rule.calculation_type === 'percentage' ? `${rule.value}%` : `₲ ${rule.value}`}<span className="ml-2 text-muted-foreground">{statusLabel[rule.status]}</span></div>{rule.status === 'draft' ? <Button size="sm" variant="outline" onClick={() => void approveRule(rule)} disabled={approvingId === rule.id}>{approvingId === rule.id ? 'Aprobando…' : 'Aprobar regla'}</Button> : null}</li>)}</ul>
  </section>
}
