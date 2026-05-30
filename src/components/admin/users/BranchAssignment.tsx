'use client'

import { useEffect, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, Star, Building2 } from 'lucide-react'
import { toast } from 'sonner'

interface Branch {
  id: string
  name: string
  city: string | null
  is_default: boolean
}

interface BranchAssignmentData {
  branchId: string
  isPrimary: boolean
}

interface BranchAssignmentProps {
  userId: string
  userRole: string
}

export function BranchAssignment({ userId, userRole }: BranchAssignmentProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [assignments, setAssignments] = useState<BranchAssignmentData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Only show for staff roles
  const isStaffRole = ['vendedor', 'tecnico', 'admin'].includes(userRole)

  const fetchData = useCallback(async () => {
    if (!isStaffRole) return
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/branches`, {
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudieron cargar sucursales')
      }

      setBranches(payload.branches || [])
      setAssignments(payload.assignments || [])
    } catch (error) {
      console.error('[BranchAssignment] Error loading:', error)
    } finally {
      setLoading(false)
    }
  }, [isStaffRole, userId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const isAssigned = (branchId: string) =>
    assignments.some(a => a.branchId === branchId)

  const isPrimary = (branchId: string) =>
    assignments.some(a => a.branchId === branchId && a.isPrimary)

  const toggleBranch = async (branchId: string, checked: boolean) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/branches`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          assigned: checked,
          primary: checked && assignments.length === 0,
        }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudo actualizar sucursal')
      }

      setBranches(payload.branches || branches)
      setAssignments(payload.assignments || [])
    } catch (error: unknown) {
      console.error('[BranchAssignment] Error toggling:', error)
      toast.error('Error al actualizar sucursal')
    } finally {
      setSaving(false)
    }
  }

  const setPrimaryBranch = async (branchId: string) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/branches`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudo cambiar sucursal principal')
      }

      setBranches(payload.branches || branches)
      setAssignments(payload.assignments || [])
      toast.success('Sucursal principal actualizada')
    } catch (error: unknown) {
      console.error('[BranchAssignment] Error setting primary:', error)
      toast.error('Error al cambiar sucursal principal')
    } finally {
      setSaving(false)
    }
  }

  if (!isStaffRole) return null

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (branches.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
          Sucursales asignadas
        </h3>
        <Badge variant="outline" className="text-xs ml-auto">
          {assignments.length} de {branches.length}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Seleccioná en qué sucursales puede operar este usuario. La sucursal principal se selecciona automáticamente al iniciar sesión.
      </p>

      <div className="grid gap-2">
        {branches.map((branch) => {
          const assigned = isAssigned(branch.id)
          const primary = isPrimary(branch.id)

          return (
            <div
              key={branch.id}
              className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                assigned
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border/60 hover:border-border'
              } ${saving ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`branch-${branch.id}`}
                  checked={assigned}
                  onCheckedChange={(checked) => toggleBranch(branch.id, Boolean(checked))}
                  disabled={saving}
                />
                <div>
                  <label
                    htmlFor={`branch-${branch.id}`}
                    className="text-sm font-medium cursor-pointer flex items-center gap-2"
                  >
                    {branch.name}
                    {primary && (
                      <Badge className="text-[10px] h-4 bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        Principal
                      </Badge>
                    )}
                  </label>
                  {branch.city && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {branch.city}
                    </p>
                  )}
                </div>
              </div>

              {assigned && !primary && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setPrimaryBranch(branch.id)}
                  disabled={saving}
                >
                  Hacer principal
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
