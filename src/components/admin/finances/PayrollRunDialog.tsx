'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  Coins,
  CreditCard,
  Info,
  Loader2,
  Search,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

type PayrollFilters = { startDate: string; endDate: string }

type PreviewEntry = {
  employeeId: string
  employeeDisplayName?: string
  role: string
  salary: number
  earnedCommissions: number
  bonuses?: number
  discounts?: number
  advances?: number
  grossPay?: number
  netPay: number
}

type Preview = {
  totals: {
    salary?: number
    earnedCommissions?: number
    bonuses?: number
    discounts?: number
    advances?: number
    grossPay?: number
    netPay: number
  }
  entries: PreviewEntry[]
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  technician: 'Técnico',
  seller: 'Vendedor',
  cashier: 'Cajero',
  support: 'Soporte',
}

function getPresetRange(preset: 'this-month' | 'last-month' | 'first-half' | 'second-half') {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const pad = (n: number) => String(n).padStart(2, '0')
  const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

  if (preset === 'this-month') {
    const lastDay = new Date(year, month + 1, 0).getDate()
    return { from: toIso(year, month, 1), to: toIso(year, month, lastDay) }
  }
  if (preset === 'last-month') {
    const prevMonthYear = month === 0 ? year - 1 : year
    const prevMonth = month === 0 ? 11 : month - 1
    const lastDay = new Date(prevMonthYear, prevMonth + 1, 0).getDate()
    return { from: toIso(prevMonthYear, prevMonth, 1), to: toIso(prevMonthYear, prevMonth, lastDay) }
  }
  if (preset === 'first-half') {
    return { from: toIso(year, month, 1), to: toIso(year, month, 15) }
  }
  if (preset === 'second-half') {
    const lastDay = new Date(year, month + 1, 0).getDate()
    return { from: toIso(year, month, 16), to: toIso(year, month, lastDay) }
  }
  return { from: '', to: '' }
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function PayrollRunDialog({
  open,
  onOpenChange,
  organizationId,
  branchId,
  filters,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  branchId: string | null | undefined
  filters: PayrollFilters
  onSaved: () => unknown | Promise<unknown>
}) {
  const [periodFrom, setPeriodFrom] = useState(filters.startDate)
  const [periodTo, setPeriodTo] = useState(filters.endDate)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [calculatedRange, setCalculatedRange] = useState<{ from: string; to: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const idempotencyKeyRef = useRef<string | null>(null)

  const isInvalidDateRange = Boolean(periodFrom && periodTo && periodFrom > periodTo)
  const isPreviewOutdated = Boolean(
    preview && calculatedRange && (calculatedRange.from !== periodFrom || calculatedRange.to !== periodTo),
  )

  const query = new URLSearchParams({ organizationId, periodFrom, periodTo })
  if (branchId) query.set('branchId', branchId)

  // Sincronización al abrir el diálogo
  useEffect(() => {
    if (!open) return
    setPeriodFrom(filters.startDate)
    setPeriodTo(filters.endDate)
    setPreview(null)
    setCalculatedRange(null)
    setError(null)
    setSearchTerm('')
    setRoleFilter('all')
    idempotencyKeyRef.current = null
  }, [open, filters.startDate, filters.endDate])

  function applyPreset(preset: 'this-month' | 'last-month' | 'first-half' | 'second-half') {
    const range = getPresetRange(preset)
    setPeriodFrom(range.from)
    setPeriodTo(range.to)
    setError(null)
  }

  async function loadPreview() {
    if (isInvalidDateRange) {
      setError('La fecha "Desde" no puede ser posterior a "Hasta".')
      return
    }
    setIsLoadingPreview(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/finances/payroll?${query.toString()}`)
      const payload = (await response.json().catch(() => null)) as { preview?: Preview; error?: string } | null
      if (!response.ok || !payload?.preview) {
        setError(payload?.error ?? 'No se pudo generar la vista previa.')
        return
      }
      setPreview(payload.preview)
      setCalculatedRange({ from: periodFrom, to: periodTo })
    } catch {
      setError('Error de conexión al generar la vista previa.')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  async function createRun() {
    if (isSubmitting || isInvalidDateRange || isPreviewOutdated) return
    setIsSubmitting(true)
    setError(null)
    idempotencyKeyRef.current ??= `payroll-${crypto.randomUUID()}`
    try {
      const response = await fetch(`/api/admin/finances/payroll?organizationId=${organizationId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': idempotencyKeyRef.current },
        body: JSON.stringify({ periodFrom, periodTo, branchId }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        setError(payload?.error ?? 'No se pudo crear la nómina.')
        return
      }
      toast.success('Corrida de nómina preparada con éxito.')
      await onSaved()
      idempotencyKeyRef.current = null
      onOpenChange(false)
    } catch {
      setError('Error al procesar la creación de nómina.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filtrado de colaboradores en la vista previa
  const filteredEntries = useMemo(() => {
    if (!preview) return []
    return preview.entries.filter((entry) => {
      const displayName = entry.employeeDisplayName || entry.employeeId
      const matchesSearch =
        !searchTerm.trim() ||
        displayName.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (ROLE_LABELS[entry.role] || entry.role).toLowerCase().includes(searchTerm.toLowerCase().trim())
      const matchesRole = roleFilter === 'all' || entry.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [preview, searchTerm, roleFilter])

  const availableRoles = useMemo(() => {
    if (!preview) return []
    const roles = new Set<string>()
    for (const e of preview.entries) {
      if (e.role) roles.add(e.role)
    }
    return Array.from(roles)
  }, [preview])

  // Desglose de totales de la vista previa
  const previewTotals = useMemo(() => {
    if (!preview) return null
    const totalSalary =
      preview.totals.salary ?? preview.entries.reduce((sum, e) => sum + (Number(e.salary) || 0), 0)
    const totalCommissions =
      preview.totals.earnedCommissions ??
      preview.entries.reduce((sum, e) => sum + (Number(e.earnedCommissions) || 0), 0)
    const totalNetPay = preview.totals.netPay

    return {
      totalSalary,
      totalCommissions,
      totalNetPay,
      employeeCount: preview.entries.length,
    }
  }, [preview])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] flex flex-col p-0 overflow-hidden sm:max-w-2xl sm:rounded-2xl shadow-2xl border-border/80">
        <DialogHeader className="shrink-0 p-5 sm:p-6 pb-4 border-b bg-card">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">Preparar nómina</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Calcula salarios base y comisiones de operaciones integradas. Una reserva o turno no genera por sí solo una comisión.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Selector de Rango de Período con Accesos Rápidos */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                Período de liquidación
              </span>
              <span className="text-[11px] text-muted-foreground">Accesos rápidos:</span>
            </div>

            {/* Presets de Fecha */}
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset('this-month')}
                className="h-7 text-[11px] px-2.5 font-medium"
              >
                Mes actual
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset('last-month')}
                className="h-7 text-[11px] px-2.5 font-medium"
              >
                Mes anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset('first-half')}
                className="h-7 text-[11px] px-2.5 font-medium"
              >
                1ª Quincena
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset('second-half')}
                className="h-7 text-[11px] px-2.5 font-medium"
              >
                2ª Quincena
              </Button>
            </div>

            {/* Inputs de Fechas */}
            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              <div className="space-y-1.5">
                <label htmlFor="payroll-from" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Desde
                </label>
                <Input
                  id="payroll-from"
                  type="date"
                  value={periodFrom}
                  onChange={(event) => setPeriodFrom(event.target.value)}
                  className={cn(isInvalidDateRange && 'border-destructive focus-visible:ring-destructive')}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="payroll-to" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Hasta
                </label>
                <Input
                  id="payroll-to"
                  type="date"
                  value={periodTo}
                  onChange={(event) => setPeriodTo(event.target.value)}
                  className={cn(isInvalidDateRange && 'border-destructive focus-visible:ring-destructive')}
                />
              </div>
            </div>

            {isInvalidDateRange && (
              <p className="text-xs text-destructive flex items-center gap-1.5 pt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                La fecha &quot;Desde&quot; no puede ser posterior a la fecha &quot;Hasta&quot;.
              </p>
            )}
          </div>

          {/* Botón de Cálculo de Vista Previa */}
          <Button
            type="button"
            variant={isPreviewOutdated ? 'default' : 'outline'}
            onClick={loadPreview}
            disabled={isLoadingPreview || isInvalidDateRange || !periodFrom || !periodTo}
            className="w-full gap-2 font-semibold shadow-xs"
          >
            {isLoadingPreview ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculando nómina en servidor…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-primary" />
                {isPreviewOutdated ? 'Actualizar vista previa (fechas cambiaron)' : preview ? 'Recalcular vista previa' : 'Ver vista previa'}
              </>
            )}
          </Button>

          {/* Advertencia si el período cambió tras la vista previa */}
          {isPreviewOutdated && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">El período seleccionado fue modificado.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Los importes visibles corresponden a las fechas anteriores ({calculatedRange?.from} al {calculatedRange?.to}). Hacé clic en &quot;Actualizar vista previa&quot; para recalcular antes de crear la nómina.
                </p>
              </div>
            </div>
          )}

          {/* Resultado de la Vista Previa */}
          {preview && previewTotals ? (
            <section aria-live="polite" className="rounded-xl border border-border/70 bg-card p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                    Resumen de Liquidación
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs font-semibold">
                  {previewTotals.employeeCount} {previewTotals.employeeCount === 1 ? 'colaborador' : 'colaboradores'}
                </Badge>
              </div>

              {/* Mini KPIs de la vista previa */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Salarios Base
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-foreground tabular-nums mt-0.5 block">
                    {formatCurrency(previewTotals.totalSalary)}
                  </span>
                </div>
                <div className="rounded-lg bg-emerald-500/10 p-2.5 text-center border border-emerald-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                    Comisiones
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5 block">
                    +{formatCurrency(previewTotals.totalCommissions)}
                  </span>
                </div>
                <div className="rounded-lg bg-primary/10 p-2.5 text-center border border-primary/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                    Total Neto
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-foreground tabular-nums mt-0.5 block">
                    {formatCurrency(previewTotals.totalNetPay)}
                  </span>
                </div>
              </div>

              {/* Filtro y Buscador si hay varios empleados */}
              {preview.entries.length > 2 && (
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por colaborador o rol…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 h-7 text-xs bg-muted/20"
                    />
                  </div>
                  {availableRoles.length > 1 && (
                    <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={roleFilter === 'all' ? 'default' : 'outline'}
                        onClick={() => setRoleFilter('all')}
                        className="h-7 text-[10px] px-2"
                      >
                        Todos
                      </Button>
                      {availableRoles.map((role) => (
                        <Button
                          key={role}
                          type="button"
                          size="sm"
                          variant={roleFilter === role ? 'default' : 'outline'}
                          onClick={() => setRoleFilter(role)}
                          className="h-7 text-[10px] px-2"
                        >
                          {ROLE_LABELS[role] || role}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Listado de colaboradores */}
              {filteredEntries.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filteredEntries.map((entry) => {
                    const displayName = entry.employeeDisplayName || entry.employeeId
                    const initials = getInitials(displayName)
                    const roleLabel = ROLE_LABELS[entry.role] || entry.role

                    return (
                      <div
                        key={entry.employeeId}
                        className="flex flex-col items-stretch gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 text-xs transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[11px]">
                            {initials || <User className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-foreground truncate">{displayName}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                                {roleLabel}
                              </Badge>
                              {entry.earnedCommissions > 0 && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  +{formatCurrency(entry.earnedCommissions)} comisiones
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 border-t pt-2 text-left sm:border-t-0 sm:pt-0 sm:text-right">
                          <p className="font-bold text-foreground text-sm tabular-nums">
                            {formatCurrency(entry.netPay)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Base: {formatCurrency(entry.salary)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : preview.entries.length > 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Ningún colaborador coincide con la búsqueda &quot;{searchTerm}&quot;.
                </p>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 p-6 text-center space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">
                    No hay colaboradores con salarios o comisiones devengadas
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    No se encontraron miembros activos con salarios base o comisiones registradas para este rango de fechas.
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {/* Banner de Guía y Buenas Prácticas */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Proceso seguro de nómina</p>
              <p className="text-[11px] leading-relaxed">
                Al hacer clic en <strong>Crear nómina</strong>, se generará una corrida en estado <strong>Borrador</strong>. Podrás auditar el detalle individual de cada colaborador, inspeccionar comprobantes de comisiones y aprobarla de forma definitiva antes de registrar los pagos.
              </p>
            </div>
          </div>

          {error ? (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 p-4 border-t bg-muted/20 sm:justify-between gap-2">
          <div className="flex items-center text-xs text-muted-foreground">
            {preview && !isPreviewOutdated && (
              <span className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-primary" />
                Listo para generar borrador
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={createRun}
              disabled={!preview || isPreviewOutdated || isInvalidDateRange || isSubmitting}
              className="gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando corrida…
                </>
              ) : (
                'Crear nómina'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
