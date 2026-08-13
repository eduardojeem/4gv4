'use client'

import { useCallback, useEffect, useState } from 'react'
import { ScrollText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

// Estilo compartido de los <select> nativos, para que se vean como los Input
// del design system. El módulo de finanzas usa selects nativos en todos sus
// formularios (mismo patrón que ExpenseDialog/PaymentDialog); se respeta esa
// consistencia interna en vez de introducir un tipo de control distinto.
const SELECT_CLASS = 'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type Employee = { user_id: string; role: string; display_name: string }
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
type ScopeType = 'employee' | 'role'
type CalculationType = 'percentage' | 'fixed'
type RuleStatus = 'draft' | 'approved'

const statusLabel = {
  draft: 'Borrador',
  approved: 'Aprobada',
  retired: 'Retirada',
} as const

// Verde para las reglas vivas (aprobadas), ámbar contorneado para borradores
// (aún no aplican a la nómina) y muteado para retiradas: así se distingue de
// un vistazo cuáles están activas en vez del texto gris plano de antes.
const STATUS_BADGE_CLASS: Record<Rule['status'], string> = {
  approved: 'border-transparent bg-emerald-600 text-white dark:bg-emerald-600/80',
  draft: 'border-amber-400 text-amber-700 dark:text-amber-300',
  retired: '',
}

const SOURCE_LABEL: Record<string, string> = {
  sale: 'Venta',
  repair: 'Reparación',
  repair_labor: 'Mano de obra',
}

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'owner', label: 'Dueño' },
  { value: 'admin', label: 'Administrador' },
  { value: 'manager', label: 'Encargado' },
  { value: 'cashier', label: 'Cajero' },
  { value: 'technician', label: 'Técnico' },
  { value: 'seller', label: 'Vendedor' },
]

const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]))

export function FinanceSettingsPanel({
  organizationId,
  branchId,
}: {
  organizationId: string
  branchId: string | null | undefined
}) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Campos del formulario controlados: los <Select> del design system (Radix)
  // no emiten un valor nativo de formulario, así que se maneja todo por estado
  // en vez de leer FormData.
  const [scopeType, setScopeType] = useState<ScopeType>('employee')
  const [employeeId, setEmployeeId] = useState('')
  const [role, setRole] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('sale')
  const [accrualStatus, setAccrualStatus] = useState<'listo' | 'entregado'>('listo')
  const [calculationType, setCalculationType] = useState<CalculationType>('percentage')
  const [value, setValue] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
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
      setIsLoading(false)
      return
    }
    setError(null)
    setEmployees(ep?.employees ?? [])
    setRules(rp?.rules ?? [])
    setIsLoading(false)
  }, [branchId, organizationId])

  // This effect synchronizes the local list with the selected finance scope.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  function resetForm() {
    setScopeType('employee')
    setEmployeeId('')
    setRole('')
    setSourceType('sale')
    setAccrualStatus('listo')
    setCalculationType('percentage')
    setValue('')
    setEffectiveFrom('')
  }

  async function submit(status: RuleStatus) {
    if (isSaving) return
    // Validación local antes de pegarle al servidor, con mensajes claros.
    if (scopeType === 'employee' && !employeeId) return setError('Elegí un empleado para la regla.')
    if (scopeType === 'role' && !role) return setError('Elegí un rol para la regla.')
    if (!value || Number(value) <= 0) return setError('Ingresá un valor mayor a cero.')
    if (!effectiveFrom) return setError('Indicá desde cuándo rige la regla.')

    setIsSaving(true)
    setError(null)
    const response = await fetch(`/api/admin/finances/commission-rules?organizationId=${organizationId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        branchId: branchId ?? undefined,
        scopeType,
        employeeId: scopeType === 'employee' ? employeeId : undefined,
        role: scopeType === 'role' ? role : undefined,
        sourceType,
        accrualStatus: sourceType === 'repair' || sourceType === 'repair_labor' ? accrualStatus : undefined,
        calculationType,
        value: Number(value),
        status,
        effectiveFrom,
      }),
    })
    const payload = await response.json().catch(() => null) as { error?: string } | null
    setIsSaving(false)
    if (!response.ok) {
      setError(payload?.error ?? 'No se pudo guardar la regla.')
      return
    }
    resetForm()
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

  return (
    <div className="space-y-6">
      {/* Crear regla */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Nueva regla de comisión</CardTitle>
          <p className="text-sm text-muted-foreground">
            Las excepciones individuales del empleado prevalecen sobre las reglas de rol. Solo las reglas aprobadas se aplican a la nómina.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submit('approved')
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="rule-scope">Alcance</Label>
              <select id="rule-scope" className={SELECT_CLASS} value={scopeType} onChange={(e) => setScopeType(e.target.value as ScopeType)}>
                <option value="employee">Empleado</option>
                <option value="role">Rol</option>
              </select>
            </div>

            {scopeType === 'employee' ? (
              <div className="grid gap-1.5">
                <Label htmlFor="rule-employee">Empleado</Label>
                <select id="rule-employee" className={SELECT_CLASS} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                  <option value="">Seleccioná un empleado</option>
                  {employees.map((employee) => (
                    <option key={employee.user_id} value={employee.user_id}>{employee.display_name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="rule-role">Rol</Label>
                <select id="rule-role" className={SELECT_CLASS} value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">Seleccioná un rol</option>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="rule-source">Origen</Label>
              <select id="rule-source" className={SELECT_CLASS} value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}>
                <option value="sale">Venta</option>
                <option value="repair">Reparación</option>
                <option value="repair_labor">Mano de obra</option>
              </select>
            </div>

            {needsAccrualStatus ? (
              <div className="grid gap-1.5">
                <Label htmlFor="rule-accrual">Estado de devengo</Label>
                <select id="rule-accrual" className={SELECT_CLASS} value={accrualStatus} onChange={(e) => setAccrualStatus(e.target.value as 'listo' | 'entregado')}>
                  <option value="listo">Listo</option>
                  <option value="entregado">Entregado</option>
                </select>
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <Label htmlFor="rule-calc">Cálculo</Label>
              <select id="rule-calc" className={SELECT_CLASS} value={calculationType} onChange={(e) => setCalculationType(e.target.value as CalculationType)}>
                <option value="percentage">Porcentaje</option>
                <option value="fixed">Monto fijo</option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="rule-value">Valor</Label>
              <Input
                id="rule-value"
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={calculationType === 'percentage' ? 'Porcentaje, ej: 5' : 'Monto fijo, ej: 50000'}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="rule-from">Vigente desde</Label>
              <Input
                id="rule-from"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </div>

            {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}

            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="button" variant="outline" disabled={isSaving} onClick={() => void submit('draft')}>
                Guardar borrador
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Crear y aprobar regla'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Reglas existentes */}
      <section aria-labelledby="rules-heading" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="rules-heading" className="text-base font-semibold">Reglas configuradas</h2>
            <p className="text-xs text-muted-foreground">Solo las aprobadas se aplican a la nómina del período.</p>
          </div>
          {!isLoading && rules.length > 0 ? (
            <span className="text-xs text-muted-foreground">{rules.length} regla{rules.length === 1 ? '' : 's'}</span>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Cargando reglas">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Todavía no hay reglas configuradas"
            description="Creá una regla arriba para empezar a calcular comisiones en la nómina."
            className="rounded-lg border bg-card"
          />
        ) : (
          <ul className="space-y-2" role="list">
            {rules.map((rule) => {
              const who = rule.scope_type === 'employee'
                ? (employees.find((e) => e.user_id === rule.employee_id)?.display_name ?? 'Empleado')
                : `Rol · ${ROLE_LABEL[String(rule.role)] ?? rule.role}`
              const source = SOURCE_LABEL[rule.source_type] ?? rule.source_type
              const amount = rule.calculation_type === 'percentage' ? `${rule.value}%` : formatCurrency(rule.value)

              return (
                <li
                  key={rule.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{who}</p>
                      <Badge
                        variant={rule.status === 'retired' ? 'secondary' : 'outline'}
                        className={cn('text-[11px]', STATUS_BADGE_CLASS[rule.status])}
                      >
                        {statusLabel[rule.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {source} · <span className="font-medium text-foreground">{amount}</span>
                    </p>
                  </div>
                  {rule.status === 'draft' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => void approveRule(rule)}
                      disabled={approvingId === rule.id}
                    >
                      {approvingId === rule.id ? 'Aprobando…' : 'Aprobar regla'}
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
