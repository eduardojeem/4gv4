'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'

type Employee = { id: string; name: string; role: string }

/**
 * Empleado del sistema que corresponde a este profesional. Con el vínculo, el
 * servicio de un turno cobrado en el POS lo comisiona quien atendió y no quien
 * cobró.
 */
export function ProfessionalEmployeeLink({ professionalId }: { professionalId: string }) {
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [userId, setUserId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/agenda/professionals/employee?id=${encodeURIComponent(professionalId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { available?: boolean; employees?: Employee[]; userId?: string | null } | null) => {
        if (cancelled) return
        setAvailable(Boolean(payload?.available))
        setEmployees(payload?.employees ?? [])
        setUserId(payload?.userId ?? '')
      })
      .catch(() => { if (!cancelled) setAvailable(false) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [professionalId])

  if (loading || !available) return null

  const save = async (next: string) => {
    const previous = userId
    setUserId(next)
    setSaving(true)
    try {
      const response = await fetch('/api/agenda/professionals/employee', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: professionalId, userId: next || null }),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo guardar el vínculo')
      toast.success(next ? 'Vinculado: sus turnos le suman comisión' : 'Vínculo quitado')
    } catch (error) {
      setUserId(previous)
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el vínculo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`professional-employee-${professionalId}`} className="flex items-center gap-2">
        Empleado para comisiones
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      </Label>
      <select
        id={`professional-employee-${professionalId}`}
        value={userId}
        onChange={(event) => void save(event.target.value)}
        disabled={saving}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        <option value="">Sin vincular</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>{employee.name}</option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        Si lo vinculás, el servicio de sus turnos le suma comisión a esta persona aunque cobre otro en el POS.
      </p>
    </div>
  )
}
