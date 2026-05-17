'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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

  const supabase = createClient()

  // Only show for staff roles
  const isStaffRole = ['vendedor', 'tecnico', 'admin'].includes(userRole)
  if (!isStaffRole) return null

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch branches
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, city, is_default')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true })

      if (branchesError) {
        // Table might not exist
        const msg = branchesError.message?.toLowerCase() || ''
        if (msg.includes('does not exist') || msg.includes('relation')) {
          setLoading(false)
          return
        }
        throw branchesError
      }

      setBranches(branchesData || [])

      // Fetch current assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('user_branch_assignments')
        .select('branch_id, is_primary')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (assignmentsError) {
        const msg = assignmentsError.message?.toLowerCase() || ''
        if (msg.includes('does not exist') || msg.includes('relation')) {
          setLoading(false)
          return
        }
        throw assignmentsError
      }

      setAssignments(
        (assignmentsData || []).map(a => ({
          branchId: a.branch_id,
          isPrimary: a.is_primary,
        }))
      )
    } catch (error) {
      console.error('[BranchAssignment] Error loading:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, userId])

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
      if (checked) {
        // Assign user to branch
        const isFirst = assignments.length === 0
        const { error } = await supabase
          .from('user_branch_assignments')
          .upsert({
            user_id: userId,
            branch_id: branchId,
            is_primary: isFirst, // First assignment is primary
            is_active: true,
          }, { onConflict: 'user_id,branch_id' })

        if (error) throw error

        setAssignments(prev => [
          ...prev,
          { branchId, isPrimary: isFirst }
        ])
      } else {
        // Remove assignment
        const { error } = await supabase
          .from('user_branch_assignments')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('branch_id', branchId)

        if (error) throw error

        setAssignments(prev => prev.filter(a => a.branchId !== branchId))

        // If we removed the primary, make the first remaining one primary
        const remaining = assignments.filter(a => a.branchId !== branchId)
        if (isPrimary(branchId) && remaining.length > 0) {
          await setPrimaryBranch(remaining[0].branchId)
        }
      }
    } catch (error: any) {
      console.error('[BranchAssignment] Error toggling:', error)
      toast.error('Error al actualizar sucursal')
    } finally {
      setSaving(false)
    }
  }

  const setPrimaryBranch = async (branchId: string) => {
    setSaving(true)
    try {
      // The DB trigger handles unsetting other primaries
      const { error } = await supabase
        .from('user_branch_assignments')
        .update({ is_primary: true })
        .eq('user_id', userId)
        .eq('branch_id', branchId)

      if (error) throw error

      setAssignments(prev =>
        prev.map(a => ({
          ...a,
          isPrimary: a.branchId === branchId,
        }))
      )
      toast.success('Sucursal principal actualizada')
    } catch (error: any) {
      console.error('[BranchAssignment] Error setting primary:', error)
      toast.error('Error al cambiar sucursal principal')
    } finally {
      setSaving(false)
    }
  }

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
