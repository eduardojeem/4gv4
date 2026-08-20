import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Building2,
  Ban,
  Calendar,
  CheckCircle2,
  Coins,
  DollarSign,
  FileText,
  Filter,
  Info,
  Layers,
  Pencil,
  Percent,
  Plus,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

// Estilo compartido de los <select> nativos
const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

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
type Compensation = {
  id: string
  organization_id: string
  employee_id: string
  base_salary: number
  pay_frequency: string
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

const STATUS_BADGE_CLASS: Record<Rule['status'], string> = {
  approved: 'border-transparent bg-emerald-600 text-white dark:bg-emerald-600/80 font-semibold',
  draft: 'border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 font-semibold',
  retired: 'bg-muted text-muted-foreground',
}

const SOURCE_LABEL: Record<string, string> = {
  sale: 'Ventas comerciales',
  repair: 'Reparaciones (Equipo)',
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

/**
 * Sobre que importe se calcula el porcentaje, en palabras.
 *
 * Es la decision mas cara de una regla y no figuraba en ninguna parte de la
 * pantalla: la comision de venta se calcula sobre el total facturado, no sobre
 * la ganancia, asi que con poco margen puede superar la utilidad de esa venta.
 */
const BASIS_LABEL: Record<SourceType, string> = {
  sale: 'del total facturado de la venta',
  repair: 'del total de la reparación',
  repair_labor: 'de la mano de obra',
}

// Modal para editar / asignar sueldo base
function EditSalaryDialog({
  employee,
  existingComp,
  organizationId,
  onClose,
  onSaved,
}: {
  employee: Employee
  existingComp?: Compensation
  organizationId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [baseSalary, setBaseSalary] = useState(existingComp?.base_salary ? String(existingComp.base_salary) : '')
  const [effectiveFrom, setEffectiveFrom] = useState(
    existingComp?.effective_from || new Date().toISOString().slice(0, 10),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!baseSalary || Number(baseSalary) < 0) {
      setError('Ingresa un sueldo base válido (mayor o igual a 0).')
      return
    }
    if (!effectiveFrom) {
      setError('Indica la fecha de vigencia del sueldo.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      if (existingComp) {
        const res = await fetch(`/api/admin/finances/compensation?organizationId=${organizationId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: existingComp.id,
            employeeId: employee.user_id,
            baseSalary: Number(baseSalary),
            effectiveFrom,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'No se pudo actualizar el sueldo base.')
      } else {
        const res = await fetch(`/api/admin/finances/compensation?organizationId=${organizationId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            employeeId: employee.user_id,
            baseSalary: Number(baseSalary),
            effectiveFrom,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'No se pudo asignar el sueldo base.')
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar sueldo base.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 flex flex-col overflow-hidden rounded-2xl shadow-2xl border-border/80">
        <DialogHeader className="shrink-0 p-5 pb-4 border-b bg-card text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {existingComp ? 'Editar Sueldo Base' : 'Asignar Sueldo Base'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Colaborador: <strong className="text-foreground">{employee.display_name}</strong> ({ROLE_LABEL[employee.role] || employee.role})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="salary-amount" className="text-xs font-semibold">
              Sueldo Base Mensual (Gs.)
            </Label>
            <Input
              id="salary-amount"
              type="number"
              min="0"
              step="1000"
              placeholder="Ej: 3500000"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              className="font-bold tabular-nums text-base"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Remuneración fija mensual garantizada para este colaborador.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="salary-from" className="text-xs font-semibold">
              Vigente Desde
            </Label>
            <Input
              id="salary-from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Fecha a partir de la cual entra en vigencia este sueldo base.
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="pt-2 border-t flex sm:justify-between gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-1.5 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              {isSaving ? 'Guardando…' : 'Guardar sueldo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function FinanceSettingsPanel({
  organizationId,
  branchId,
}: {
  organizationId: string
  branchId: string | null | undefined
}) {
  const [activeSubTab, setActiveSubTab] = useState<'rules' | 'personnel'>('rules')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [compensations, setCompensations] = useState<Compensation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [ruleFilter, setRuleFilter] = useState<'all' | 'sale' | 'repair' | 'employee' | 'role'>('all')
  const [editingSalaryEmp, setEditingSalaryEmp] = useState<Employee | null>(null)

  // Campos de formulario para nueva regla
  const [scopeType, setScopeType] = useState<ScopeType>('employee')
  const [employeeId, setEmployeeId] = useState('')
  const [role, setRole] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('sale')
  const [accrualStatus, setAccrualStatus] = useState<'listo' | 'entregado'>('listo')
  const [calculationType, setCalculationType] = useState<CalculationType>('percentage')
  const [value, setValue] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')

  const loadCompensations = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/finances/compensation?organizationId=${organizationId}`)
      const cp = (await res.json().catch(() => null)) as { compensation?: Compensation[]; error?: string } | null
      if (res.ok && cp?.compensation) {
        setCompensations(cp.compensation)
      }
    } catch {
      // Ignored for non-blocking UI
    }
  }, [organizationId])

  const load = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams({ organizationId })
    if (branchId) params.set('branchId', branchId)
    const [employeeResponse, ruleResponse] = await Promise.all([
      fetch(`/api/admin/finances/employees?organizationId=${organizationId}`),
      fetch(`/api/admin/finances/commission-rules?${params.toString()}`),
    ])
    const ep = (await employeeResponse.json().catch(() => null)) as { employees?: Employee[]; error?: string } | null
    const rp = (await ruleResponse.json().catch(() => null)) as { rules?: Rule[]; error?: string } | null

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

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (activeSubTab === 'personnel') {
      void loadCompensations()
    }
  }, [activeSubTab, loadCompensations])

  function resetForm() {
    setScopeType('employee')
    setEmployeeId('')
    setRole('')
    setSourceType('sale')
    setAccrualStatus('listo')
    setCalculationType('percentage')
    setValue('')
    setEffectiveFrom('')
    setEffectiveTo('')
  }

  async function submit(status: RuleStatus) {
    if (isSaving) return
    if (scopeType === 'employee' && !employeeId) return setError('Elegí un empleado para la regla.')
    if (scopeType === 'role' && !role) return setError('Elegí un rol para la regla.')
    if (!value || Number(value) <= 0) return setError('Ingresá un valor mayor a cero.')
    if (!effectiveFrom) return setError('Indicá desde cuándo rige la regla.')
    if (effectiveTo && effectiveTo < effectiveFrom) {
      return setError('La fecha de fin no puede ser anterior a la de inicio.')
    }
    if (calculationType === 'percentage' && Number(value) > 100) {
      return setError('El porcentaje no puede superar el 100% del importe base.')
    }

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
        effectiveTo: effectiveTo || undefined,
      }),
    })
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
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
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    setApprovingId(null)
    if (!response.ok) {
      setError(payload?.error ?? 'No se pudo aprobar la regla.')
      return
    }
    await load()
  }

  /**
   * Retira una regla aprobada: deja de comisionar de aca en adelante.
   *
   * No se borra. La base tiene `on delete restrict` sobre los devengados, asi
   * que una regla que ya genero comisiones no se puede eliminar —y esta bien:
   * borrarla dejaria sin explicacion las comisiones que ya se pagaron.
   */
  async function retireRule(rule: Rule) {
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
        status: 'retired',
        effectiveFrom: rule.effective_from,
        effectiveTo: rule.effective_to ?? undefined,
      }),
    })
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    setApprovingId(null)
    if (!response.ok) {
      setError(payload?.error ?? 'No se pudo retirar la regla.')
      return
    }
    await load()
  }

  const needsAccrualStatus = sourceType === 'repair' || sourceType === 'repair_labor'

  // Previsualización dinámica de la regla
  const previewText = useMemo(() => {
    const targetName =
      scopeType === 'employee'
        ? employees.find((e) => e.user_id === employeeId)?.display_name || 'el colaborador seleccionado'
        : role
        ? `el rol ${ROLE_LABEL[role] || role}`
        : 'el rol seleccionado'

    const actName =
      sourceType === 'sale'
        ? 'cada venta comercial'
        : sourceType === 'repair'
        ? `cada reparación técnica (estado: ${accrualStatus})`
        : `cada mano de obra técnica (estado: ${accrualStatus})`

    const valText = value
      ? calculationType === 'percentage'
        ? `${value}% ${BASIS_LABEL[sourceType]}`
        : formatCurrency(Number(value))
      : calculationType === 'percentage'
      ? `[X]% ${BASIS_LABEL[sourceType]}`
      : '[Monto]'

    const dateText = effectiveFrom ? `a partir del ${effectiveFrom}` : 'desde su fecha de vigencia'
    const endText = effectiveTo ? ` y hasta el ${effectiveTo}` : ' sin fecha de fin'

    return `Aplica para ${targetName}: percibirá ${valText} por ${actName}, ${dateText}${endText}.`
  }, [
    accrualStatus,
    calculationType,
    effectiveFrom,
    effectiveTo,
    employeeId,
    employees,
    role,
    scopeType,
    sourceType,
    value,
  ])

  // Filtrado de reglas
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (ruleFilter === 'sale') return r.source_type === 'sale'
      if (ruleFilter === 'repair') return r.source_type === 'repair' || r.source_type === 'repair_labor'
      if (ruleFilter === 'employee') return r.scope_type === 'employee'
      if (ruleFilter === 'role') return r.scope_type === 'role'
      return true
    })
  }, [rules, ruleFilter])

  // Estadísticas del personal
  const totalBasePayroll = useMemo(() => {
    return compensations.reduce((sum, c) => sum + (Number(c.base_salary) || 0), 0)
  }, [compensations])

  const employeesWithBase = useMemo(() => {
    return employees.filter((e) => compensations.some((c) => c.employee_id === e.user_id)).length
  }, [employees, compensations])

  return (
    <div className="space-y-6">
      {/* Selector de Sub-Pestaña de Configuración */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setActiveSubTab('rules')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
              activeSubTab === 'rules'
                ? 'bg-card text-foreground shadow-xs border border-border/70'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Reglas de Comisión
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {rules.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('personnel')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
              activeSubTab === 'personnel'
                ? 'bg-card text-foreground shadow-xs border border-border/70'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Users className="h-3.5 w-3.5 text-primary" />
            Personal y Sueldos Base
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {employees.length}
            </Badge>
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          {activeSubTab === 'rules'
            ? 'Reglas automáticas de comisión para vendedores y técnicos.'
            : 'Asignación de remuneración fija mensual por colaborador.'}
        </p>
      </div>

      {/* ======================================================== */}
      {/* SECCIÓN 1: REGLAS DE COMISIÓN                            */}
      {/* ======================================================== */}
      {activeSubTab === 'rules' && (
        <div className="space-y-6">
          {/* Tarjeta de Creación de Regla */}
          <Card className="border-border/80 shadow-md overflow-hidden sm:rounded-2xl">
            <CardHeader className="p-6 pb-4 border-b bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Nueva regla de comisión</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Configura comisiones automáticas por ventas o servicios técnicos para motivar a tu equipo.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void submit('approved')
                }}
                className="space-y-5"
              >
                {/* Grid de Configuración de la Regla */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* 1. Alcance */}
                  <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/10 p-3.5">
                    <Label
                      htmlFor="rule-scope"
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                    >
                      <Users className="h-3.5 w-3.5 text-primary" />
                      Alcance de la regla
                    </Label>
                    <select
                      id="rule-scope"
                      aria-label="Alcance"
                      className={SELECT_CLASS}
                      value={scopeType}
                      onChange={(e) => setScopeType(e.target.value as ScopeType)}
                    >
                      <option value="employee">Empleado individual</option>
                      <option value="role">Rol general</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      Las reglas individuales prevalecen sobre el rol.
                    </p>
                  </div>

                  {/* 2. Empleado o Rol según alcance */}
                  {scopeType === 'employee' ? (
                    <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/10 p-3.5">
                      <Label
                        htmlFor="rule-employee"
                        className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                      >
                        <User className="h-3.5 w-3.5 text-primary" />
                        Empleado beneficiario
                      </Label>
                      <select
                        id="rule-employee"
                        aria-label="Empleado"
                        className={SELECT_CLASS}
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                      >
                        <option value="">Seleccioná un empleado</option>
                        {employees.map((employee) => (
                          <option key={employee.user_id} value={employee.user_id}>
                            {employee.display_name} ({ROLE_LABEL[employee.role] || employee.role})
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-muted-foreground">
                        Asignación específica para este colaborador.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/10 p-3.5">
                      <Label
                        htmlFor="rule-role"
                        className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                      >
                        <Users className="h-3.5 w-3.5 text-primary" />
                        Rol beneficiario
                      </Label>
                      <select
                        id="rule-role"
                        aria-label="Rol"
                        className={SELECT_CLASS}
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                      >
                        <option value="">Seleccioná un rol</option>
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-muted-foreground">
                        Aplica a todo el personal con este rol asignado.
                      </p>
                    </div>
                  )}

                  {/* 3. Origen */}
                  <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/10 p-3.5">
                    <Label
                      htmlFor="rule-source"
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                    >
                      <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                      Origen de la comisión
                    </Label>
                    <select
                      id="rule-source"
                      aria-label="Origen"
                      className={SELECT_CLASS}
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value as SourceType)}
                    >
                      <option value="sale">Ventas comerciales</option>
                      <option value="repair">Reparaciones (Equipo completo)</option>
                      <option value="repair_labor">Reparaciones (Solo mano de obra)</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      Tipo de operación que genera el incentivo.
                    </p>
                  </div>

                  {/* 4. Estado de Devengo (si es reparación) */}
                  {needsAccrualStatus ? (
                    <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/10 p-3.5">
                      <Label
                        htmlFor="rule-accrual"
                        className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                      >
                        <Wrench className="h-3.5 w-3.5 text-primary" />
                        Momento de liquidación
                      </Label>
                      <select
                        id="rule-accrual"
                        aria-label="Estado de devengo"
                        className={SELECT_CLASS}
                        value={accrualStatus}
                        onChange={(e) => setAccrualStatus(e.target.value as 'listo' | 'entregado')}
                      >
                        <option value="listo">Al marcar como Listo</option>
                        <option value="entregado">Al entregar al cliente</option>
                      </select>
                      <p className="text-[11px] text-muted-foreground">
                        Momento exacto en que el técnico devenga la comisión.
                      </p>
                    </div>
                  ) : null}

                  {/* 5. Tipo de Cálculo */}
                  <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/10 p-3.5">
                    <Label
                      htmlFor="rule-calc"
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                    >
                      <Percent className="h-3.5 w-3.5 text-primary" />
                      Modalidad de cálculo
                    </Label>
                    <select
                      id="rule-calc"
                      aria-label="Cálculo"
                      className={SELECT_CLASS}
                      value={calculationType}
                      onChange={(e) => setCalculationType(e.target.value as CalculationType)}
                    >
                      <option value="percentage">Porcentaje sobre importe base (%)</option>
                      <option value="fixed">Monto fijo en efectivo (Gs.)</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      Fórmula a aplicar sobre cada registro.
                    </p>
                  </div>

                  {/* 6. Valor de Comisión */}
                  <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/10 p-3.5">
                    <Label
                      htmlFor="rule-value"
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                    >
                      <Coins className="h-3.5 w-3.5 text-primary" />
                      Valor o Importe
                    </Label>
                    <Input
                      id="rule-value"
                      aria-label="Valor"
                      type="number"
                      min="0"
                      step="0.01"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder={calculationType === 'percentage' ? 'Ej: 5 (para 5%)' : 'Ej: 50000'}
                      className="font-bold tabular-nums"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {calculationType === 'percentage'
                        ? `Porcentaje ${BASIS_LABEL[sourceType]} (máximo 100%)`
                        : 'Importe fijo por cada operación'}
                    </p>
                  </div>

                  {/* 7. Vigencia Desde */}
                  <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/10 p-3.5 sm:col-span-2 lg:col-span-3">
                    <Label
                      htmlFor="rule-from"
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                    >
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Vigente desde
                    </Label>
                    <Input
                      id="rule-from"
                      aria-label="Vigente desde"
                      type="date"
                      value={effectiveFrom}
                      onChange={(event) => setEffectiveFrom(event.target.value)}
                      className="max-w-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Las ventas o reparaciones ocurridas a partir de esta fecha calcularán comisiones con esta regla.
                    </p>
                  </div>

                  {/* 8. Vigencia Hasta (opcional) */}
                  <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/10 p-3.5 sm:col-span-2 lg:col-span-3">
                    <Label
                      htmlFor="rule-to"
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                    >
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Vigente hasta <span className="font-medium normal-case">(opcional)</span>
                    </Label>
                    <Input
                      id="rule-to"
                      aria-label="Vigente hasta"
                      type="date"
                      value={effectiveTo}
                      min={effectiveFrom || undefined}
                      onChange={(event) => setEffectiveTo(event.target.value)}
                      className="max-w-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Dejalo vacío si la comisión no vence. Para una promoción por
                      temporada, poné la fecha de cierre acá y la regla deja de
                      comisionar sola.
                    </p>
                  </div>
                </div>

                {/* Vista Previa de la Regla en Lenguaje Natural */}
                <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
                  <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground">Resumen de la regla:</p>
                    <p className="leading-relaxed text-muted-foreground">{previewText}</p>
                  </div>
                </div>

                {error ? (
                  <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    {error}
                  </div>
                ) : null}

                {/* Botones de Guardado */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/60 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => void submit('draft')}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Guardar borrador
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="gap-1.5 text-xs font-semibold shadow-xs"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {isSaving ? 'Guardando…' : 'Crear y aprobar regla'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Reglas Existentes con Filtro Rápido */}
          <section aria-labelledby="rules-heading" className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 id="rules-heading" className="text-base font-bold text-foreground">
                  Reglas de comisión configuradas
                </h2>
                <p className="text-xs text-muted-foreground">
                  Solo las reglas aprobadas se materializan en las corridas de nómina.
                </p>
              </div>

              {/* Filtros Rápidos */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'Todas' },
                    { id: 'sale', label: 'Ventas' },
                    { id: 'repair', label: 'Reparaciones' },
                    { id: 'employee', label: 'Por Empleado' },
                    { id: 'role', label: 'Por Rol' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setRuleFilter(f.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors',
                      ruleFilter === f.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border/60 hover:bg-muted/30',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Cargando reglas">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredRules.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="No se encontraron reglas con este filtro"
                description="Ajusta el filtro o crea una regla arriba para incentivar a tu equipo."
                className="rounded-xl border bg-card p-8"
              />
            ) : (
              <ul className="space-y-2.5" role="list">
                {filteredRules.map((rule) => {
                  const who =
                    rule.scope_type === 'employee'
                      ? employees.find((e) => e.user_id === rule.employee_id)?.display_name ?? 'Empleado'
                      : `Rol: ${ROLE_LABEL[String(rule.role)] ?? rule.role}`
                  const source = SOURCE_LABEL[rule.source_type] ?? rule.source_type
                  const amount =
                    rule.calculation_type === 'percentage'
                      ? `${rule.value}% ${BASIS_LABEL[rule.source_type as SourceType] ?? 'del importe base'}`
                      : formatCurrency(rule.value)
                  const isRepair = rule.source_type === 'repair' || rule.source_type === 'repair_labor'

                  return (
                    <li
                      key={rule.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/10"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          {isRepair ? <Wrench className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-foreground text-sm">{who}</p>
                            <Badge
                              variant={rule.status === 'retired' ? 'secondary' : 'outline'}
                              className={cn('text-[10px] px-2 py-0.5', STATUS_BADGE_CLASS[rule.status])}
                            >
                              {statusLabel[rule.status]}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{source}</span>
                            <span>·</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{amount}</span>
                            <span>·</span>
                            <span>
                              Desde {rule.effective_from}
                              {rule.effective_to ? ` hasta ${rule.effective_to}` : ''}
                            </span>
                            {rule.accrual_status ? (
                              <>
                                <span>·</span>
                                <span>Devengo: {rule.accrual_status}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                        {rule.status === 'draft' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 text-xs font-semibold"
                            onClick={() => void approveRule(rule)}
                            disabled={approvingId === rule.id}
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                            {approvingId === rule.id ? 'Aprobando…' : 'Aprobar regla'}
                          </Button>
                        ) : null}
                        {rule.status === 'approved' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 h-8 text-xs font-semibold text-muted-foreground hover:text-destructive"
                            onClick={() => void retireRule(rule)}
                            disabled={approvingId === rule.id}
                            title="Deja de comisionar de aquí en adelante. Las comisiones ya devengadas no se tocan."
                          >
                            <Ban className="h-3.5 w-3.5" />
                            {approvingId === rule.id ? 'Retirando…' : 'Retirar'}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECCIÓN 2: PERSONAL Y SUELDOS BASE                       */}
      {/* ======================================================== */}
      {activeSubTab === 'personnel' && (
        <div className="space-y-6">
          {/* Tarjetas KPI de Personal */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="border-l-4 border-l-primary border-border/70 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Colaboradores
                </span>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-bold text-foreground">{employees.length}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Personal registrado en nómina</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 border-border/70 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Sueldos Asignados
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {employeesWithBase} / {employees.length}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Con sueldo base configurado</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-500 border-border/70 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Masa Salarial Fija
                </span>
                <Wallet className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-bold text-foreground tabular-nums">
                  {formatCurrency(totalBasePayroll)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Sueldo fijo total mensual</p>
              </CardContent>
            </Card>
          </div>

          {/* Listado de Colaboradores */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Personal y Remuneraciones Base</h3>
                <p className="text-xs text-muted-foreground">
                  Administra el salario fijo mensual de cada miembro del equipo para las corridas de nómina.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : employees.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No hay colaboradores en la organización"
                description="Invita miembros a tu equipo para poder asignarles sueldos y comisiones."
                className="rounded-xl border bg-card p-8"
              />
            ) : (
              <div className="space-y-2.5">
                {employees.map((emp) => {
                  const comp = compensations.find((c) => c.employee_id === emp.user_id)
                  const empRules = rules.filter((r) => r.scope_type === 'employee' && r.employee_id === emp.user_id)
                  const isTech = emp.role === 'technician'
                  const isSeller = emp.role === 'seller'

                  return (
                    <div
                      key={emp.user_id}
                      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/10"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          {isTech ? <Wrench className="h-5 w-5" /> : isSeller ? <ShoppingBag className="h-5 w-5" /> : <User className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-foreground text-sm truncate">{emp.display_name}</p>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              {ROLE_LABEL[emp.role] || emp.role}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {comp ? (
                              <>
                                <span>
                                  Sueldo base: <strong className="text-foreground">{formatCurrency(Number(comp.base_salary))}</strong>/mes
                                </span>
                                <span>·</span>
                                <span>Desde {comp.effective_from}</span>
                              </>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                Sin sueldo base asignado
                              </span>
                            )}
                            {empRules.length > 0 && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                  <Coins className="h-3 w-3" />
                                  {empRules.length} regla{empRules.length === 1 ? '' : 's'} individual{empRules.length === 1 ? '' : 'es'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSalaryEmp(emp)}
                          className="gap-1.5 h-8 text-xs font-semibold"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {comp ? 'Modificar sueldo' : 'Asignar sueldo'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para Asignar / Modificar Sueldo Base */}
      {editingSalaryEmp && (
        <EditSalaryDialog
          employee={editingSalaryEmp}
          existingComp={compensations.find((c) => c.employee_id === editingSalaryEmp.user_id)}
          organizationId={organizationId}
          onClose={() => setEditingSalaryEmp(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  )
}
