'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CheckCheck, Loader2, PackageX, Sparkles, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import type { Repair, RepairQualityCheckResult } from '@/types/repairs'
import type { RepairQualityChecklist } from '@/lib/repairs/quality-check'
import { branchHeaders } from '@/lib/branches/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const emptyChecklist: RepairQualityChecklist = {
  powersOn: false,
  reportedIssueResolved: false,
  basicFunctions: false,
  physicalCondition: false,
  accessoriesVerified: false,
}

const checks: Array<{ key: keyof RepairQualityChecklist; label: string }> = [
  { key: 'powersOn', label: 'Enciende correctamente' },
  { key: 'reportedIssueResolved', label: 'Falla original solucionada' },
  { key: 'basicFunctions', label: 'Funciones básicas probadas' },
  { key: 'physicalCondition', label: 'Estado físico verificado' },
  { key: 'accessoriesVerified', label: 'Accesorios verificados' },
]

const suggestionsByResult: Record<RepairQualityCheckResult, string[]> = {
  passed: [
    'Equipo probado al 100% y operativo',
    'Batería cargada y funciones probadas',
    'Limpieza interna y externa realizada',
    'Se recomienda protector y funda al cliente',
  ],
  failed: [
    'No retiene carga de batería / no carga',
    'Falla táctil intermitente / pantalla parpadea',
    'Reinicio inesperado en uso',
    'Cámara o micrófono con distorsión o sin respuesta',
    'Falla de conectividad Wi-Fi o señal',
    'Audio distorsionado en altavoz o auricular',
  ],
  unrepairable: [
    'Daño severo en placa madre sin reparación viable',
    'Repuesto descontinuado o sin stock disponible',
    'Sulfatación avanzada / corrosión por líquidos',
    'Cortocircuito en CPU o memoria principal',
    'Costo de repuestos excede el valor comercial',
  ],
  withdrawn: [
    'Cliente retira sin autorizar presupuesto',
    'Cliente necesita el equipo con urgencia sin reparar',
    'Presupuesto rechazado por el cliente',
    'Sin respuesta del cliente para autorizar trabajo',
    'Retiro para evaluación en otro servicio técnico',
  ],
}

const results = [
  { value: 'passed' as const, label: 'Funciona correctamente', icon: CheckCircle2, tone: 'border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300' },
  { value: 'failed' as const, label: 'Falló la prueba final', icon: AlertTriangle, tone: 'border-rose-300 text-rose-800 dark:border-rose-800 dark:text-rose-300' },
  { value: 'unrepairable' as const, label: 'No fue posible reparar', icon: Wrench, tone: 'border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300' },
  { value: 'withdrawn' as const, label: 'Retiro sin reparar', icon: PackageX, tone: 'border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300' },
]

export function RepairQualityCheckDialog({ open, repair, branchId, onOpenChange, onSaved }: {
  open: boolean
  repair: Repair | null
  branchId?: string | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}) {
  const [result, setResult] = useState<RepairQualityCheckResult>('passed')
  const [checklist, setChecklist] = useState<RepairQualityChecklist>(emptyChecklist)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setResult('passed')
    setChecklist(emptyChecklist)
    setNote('')
  }, [open, repair?.id])

  const allChecked = useMemo(() => checks.every(({ key }) => checklist[key]), [checklist])

  const currentSuggestions = useMemo(() => {
    const list = [...suggestionsByResult[result]]
    if (result === 'failed' && repair?.issue?.trim()) {
      list.unshift(`Persiste la falla reportada: ${repair.issue.trim()}`)
    }
    return list
  }, [result, repair?.issue])

  const handleApplySuggestion = (suggestion: string) => {
    setNote((current) => {
      const trimmed = current.trim()
      if (!trimmed) return suggestion
      if (trimmed.includes(suggestion)) {
        const parts = trimmed
          .split(/(?:\. |\.\s*$|\n)/)
          .map((p) => p.trim())
          .filter((p) => p && p !== suggestion.trim())
        return parts.join('. ')
      }
      return `${trimmed.replace(/\.*$/, '')}. ${suggestion}`
    })
  }

  const handleToggleAll = () => {
    const nextValue = !allChecked
    setChecklist({
      powersOn: nextValue,
      reportedIssueResolved: nextValue,
      basicFunctions: nextValue,
      physicalCondition: nextValue,
      accessoriesVerified: nextValue,
    })
  }

  const complete = useMemo(() => result === 'passed'
    ? checks.every(({ key }) => checklist[key])
    : note.trim().length >= 5, [checklist, note, result])

  const submitLabel = result === 'passed'
    ? 'Aprobar y marcar listo'
    : result === 'failed'
      ? 'Registrar falla y volver a reparación'
      : 'Registrar como listo para retiro'

  const handleSubmit = async () => {
    if (!repair || !complete) return
    setSaving(true)
    try {
      const response = await fetch(`/api/repairs/${repair.id}/quality-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...branchHeaders(branchId) },
        body: JSON.stringify({ result, checklist, note: note.trim() || undefined }),
      })
      const body = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error || 'No se pudo guardar la verificación técnica.')
      await onSaved()
      toast.success(result === 'failed' ? 'Falla registrada; el equipo vuelve a reparación' : 'Verificación registrada; el equipo está listo para retiro')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la verificación técnica.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-4 py-4 sm:px-6">
          <DialogTitle>Verificación previa a la entrega</DialogTitle>
          <DialogDescription>
            {repair ? `${repair.brand} ${repair.model} · ${repair.ticketNumber || repair.id.slice(0, 8)}` : 'Comprobá el equipo antes de dejarlo disponible para caja.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Resultado técnico</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {results.map((option) => {
                const Icon = option.icon
                return (
                  <button key={option.value} type="button" onClick={() => setResult(option.value)} aria-pressed={result === option.value}
                    className={cn('flex min-h-11 items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm font-semibold', result === option.value ? option.tone + ' bg-muted/40' : 'border-border text-muted-foreground')}>
                    <Icon className="h-4 w-4 shrink-0" />{option.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {result === 'passed' ? (
            <div className="space-y-4">
              <fieldset className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between pb-1 px-1">
                  <legend className="text-sm font-semibold">Checklist obligatorio</legend>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleAll}
                    className="h-7 gap-1.5 px-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    {allChecked ? 'Desmarcar todo' : 'Marcar todo'}
                  </Button>
                </div>
                {checks.map(({ key, label }) => (
                  <div key={key} className="flex min-h-10 items-center gap-3 rounded-md px-2 hover:bg-muted/40">
                    <Checkbox id={`quality-${key}`} checked={checklist[key]} onCheckedChange={(checked) => setChecklist((current) => ({ ...current, [key]: checked === true }))} />
                    <Label htmlFor={`quality-${key}`} className="flex-1 cursor-pointer text-sm">{label}</Label>
                  </div>
                ))}
              </fieldset>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="quality-note" className="text-sm">
                    Observaciones / Detalles adicionales <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  {note && (
                    <button
                      type="button"
                      onClick={() => setNote('')}
                      className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <Textarea
                  id="quality-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  placeholder="Detalles de la prueba o recomendaciones para el cliente..."
                />
                <div className="space-y-1.5 pt-0.5">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" /> Sugerencias rápidas:
                  </span>
                  <div className="flex flex-wrap gap-1.5" aria-label="Sugerencias para equipo funcionando">
                    {currentSuggestions.map((suggestion) => {
                      const active = note.includes(suggestion)
                      return (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleApplySuggestion(suggestion)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                            active
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                              : 'border-border bg-muted/40 text-muted-foreground hover:border-border/80 hover:bg-muted hover:text-foreground'
                          )}
                        >
                          {active ? '✓ ' : '+ '}
                          {suggestion}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="quality-note">
                  {result === 'failed'
                    ? 'Qué falló y qué debe revisar el técnico'
                    : result === 'unrepairable'
                      ? 'Motivo por el cual no fue posible reparar'
                      : 'Motivo y detalle del retiro del cliente'}
                </Label>
                {note && (
                  <button
                    type="button"
                    onClick={() => setNote('')}
                    className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <Textarea
                id="quality-note"
                required
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder={
                  result === 'failed'
                    ? 'Ej.: enciende, pero la pantalla pierde imagen después de unos minutos.'
                    : result === 'unrepairable'
                      ? 'Explicá el motivo técnico por el cual no se pudo reparar.'
                      : 'Explicá por qué el cliente retira el equipo sin reparar.'
                }
              />
              <p className="text-xs text-muted-foreground">Esta observación queda en el historial y será visible para caja.</p>

              <div className="space-y-1.5 pt-1">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" /> Sugerencias rápidas:
                </span>
                <div className="flex flex-wrap gap-1.5" aria-label="Sugerencias de detalle">
                  {currentSuggestions.map((suggestion) => {
                    const active = note.includes(suggestion)
                    return (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleApplySuggestion(suggestion)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                          active
                            ? 'border-primary bg-primary/10 text-primary font-medium dark:bg-primary/20'
                            : 'border-border bg-muted/40 text-muted-foreground hover:border-border/80 hover:bg-muted hover:text-foreground'
                        )}
                      >
                        {active ? '✓ ' : '+ '}
                        {suggestion}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 border-t px-4 py-3 sm:flex sm:px-6">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={!complete || saving} onClick={handleSubmit} className={cn(result === 'failed' && 'bg-rose-600 hover:bg-rose-700')}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}{submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
