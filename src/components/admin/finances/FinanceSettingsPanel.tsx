'use client'

import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

type Employee = { user_id: string; role: string }
type Rule = {
  id: string
  scope_type: string
  employee_id: string | null
  role: string | null
  source_type: string
  calculation_type: string
  value: number
}
type SourceType = 'sale' | 'repair' | 'repair_labor'

export function FinanceSettingsPanel({ organizationId, branchId }: {
  organizationId: string
  branchId: string | null | undefined
}) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
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
    const scopeType = String(form.get('scopeType'))
    const response = await fetch(`/api/admin/finances/commission-rules?organizationId=${organizationId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        branchId: branchId ?? undefined,
        scopeType,
        employeeId: scopeType === 'employee' ? form.get('employeeId') : undefined,
        role: scopeType === 'role' ? form.get('role') : undefined,
        sourceType,
        accrualStatus: sourceType === 'repair' || sourceType === 'repair_labor' ? accrualStatus : undefined,
        calculationType: form.get('calculationType'),
        value: Number(form.get('value')),
        status: 'draft',
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

  const needsAccrualStatus = sourceType === 'repair' || sourceType === 'repair_labor'

  return <section className="space-y-4 rounded-lg border p-4">
    <div>
      <h2 className="font-semibold">Configuración de comisiones</h2>
      <p className="text-sm text-muted-foreground">Las excepciones individuales del empleado prevalecen sobre las reglas de rol.</p>
    </div>
    <form action={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-medium">Alcance<select name="scopeType" className="rounded-md border bg-background px-3 py-2"><option value="employee">Empleado</option><option value="role">Rol</option></select></label>
      <label className="grid gap-1 text-sm font-medium">Empleado<select name="employeeId" className="rounded-md border bg-background px-3 py-2"><option value="">Selecciona</option>{employees.map((employee) => <option key={employee.user_id} value={employee.user_id}>{employee.user_id}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-medium">Rol<select name="role" className="rounded-md border bg-background px-3 py-2"><option value="">Selecciona</option>{['owner', 'admin', 'manager', 'cashier', 'technician', 'seller'].map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-medium">Origen<select aria-label="Origen" value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceType)} className="rounded-md border bg-background px-3 py-2"><option value="sale">Venta</option><option value="repair">Reparación</option><option value="repair_labor">Mano de obra</option></select></label>
      {needsAccrualStatus ? <label className="grid gap-1 text-sm font-medium">Estado de devengo<select aria-label="Estado de devengo" value={accrualStatus} onChange={(event) => setAccrualStatus(event.target.value as 'listo' | 'entregado')} className="rounded-md border bg-background px-3 py-2"><option value="listo">Listo</option><option value="entregado">Entregado</option></select></label> : null}
      <label className="grid gap-1 text-sm font-medium">Cálculo<select name="calculationType" className="rounded-md border bg-background px-3 py-2"><option value="percentage">Porcentaje</option><option value="fixed">Monto fijo</option></select></label>
      <label className="grid gap-1 text-sm font-medium">Valor<input name="value" type="number" min="0" step="0.01" required className="rounded-md border bg-background px-3 py-2" /></label>
      <label className="grid gap-1 text-sm font-medium">Vigente desde<input name="effectiveFrom" type="date" required className="rounded-md border bg-background px-3 py-2" /></label>
      {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
      <Button type="submit" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Agregar regla'}</Button>
    </form>
    <ul className="divide-y text-sm">{rules.map((rule) => <li key={rule.id} className="py-2">{rule.scope_type === 'employee' ? `Empleado ${rule.employee_id}` : `Rol ${rule.role}`} · {rule.source_type} · {rule.calculation_type === 'percentage' ? `${rule.value}%` : `₲ ${rule.value}`}</li>)}</ul>
  </section>
}
