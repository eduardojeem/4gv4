'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import type { SupabaseUser } from '@/hooks/use-users-supabase'
import { PERMISSION_GROUPS } from './permissions'
import { ROLE_PERMISSIONS, WHOLESALE_PRICE_PERMISSION } from '@/lib/auth/roles-permissions'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().optional(),
  role: z.enum(['super_admin', 'admin', 'vendedor', 'tecnico', 'cliente']),
  status: z.enum(['active', 'inactive', 'suspended']),
  department: z.string().optional(),
  permissions: z.array(z.string()).default([]),
})

type FormValues = z.infer<typeof schema>

function setPermission(
  currentPermissions: string[],
  permissionId: string,
  enabled: boolean
): string[] {
  const currentSet = new Set(currentPermissions)
  if (enabled) {
    currentSet.add(permissionId)
  } else {
    currentSet.delete(permissionId)
  }
  return Array.from(currentSet)
}

export function EditUserForm({
  user,
  isSubmitting,
  onSubmit,
  onCancel,
  canAssignSuperAdmin = false,
}: {
  user: SupabaseUser
  isSubmitting: boolean
  onSubmit: (values: FormValues) => Promise<void>
  onCancel: () => void
  canAssignSuperAdmin?: boolean
}) {
  const [permissionSearch, setPermissionSearch] = useState('')

  const defaultValues: FormValues = useMemo(
    () => ({
      name: user.name || '',
      phone: user.phone || '',
      role: (user.role as FormValues['role']) || 'cliente',
      status: (user.status as FormValues['status']) || 'active',
      department: user.department || '',
      permissions: user.permissions || [],
    }),
    [user]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues,
    mode: 'onChange',
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const role = useWatch({ control: form.control, name: 'role' })
  const specificPermissions = useWatch({ control: form.control, name: 'permissions' }) || []

  const roleEffective = useMemo(() => {
    const roleConfig = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]
    return roleConfig ? roleConfig.permissions.map((permission) => permission.id) : []
  }, [role])

  const effectiveSet = useMemo(() => {
    return Array.from(new Set([...roleEffective, ...specificPermissions]))
  }, [roleEffective, specificPermissions])

  const hasWholesalePermission = specificPermissions.includes(WHOLESALE_PRICE_PERMISSION)

  const filteredPermissionGroups = useMemo(() => {
    const normalizedSearch = permissionSearch.trim().toLowerCase()
    if (!normalizedSearch) return PERMISSION_GROUPS

    return PERMISSION_GROUPS
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) => {
          return (
            permission.label.toLowerCase().includes(normalizedSearch) ||
            permission.id.toLowerCase().includes(normalizedSearch)
          )
        }),
      }))
      .filter((group) => group.permissions.length > 0)
  }, [permissionSearch])

  const handleSubmit = form.handleSubmit(async (values) => {
    const dirtyFields = form.formState.dirtyFields as Record<string, unknown>
    const payload: Record<string, unknown> = {}

    Object.entries(dirtyFields).forEach(([key, isDirty]) => {
      if (isDirty) {
        payload[key] = (values as Record<string, unknown>)[key]
      }
    })

    if (Object.keys(payload).length === 0) return

    await onSubmit(payload as FormValues)
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="grid gap-6 py-4">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Informacion personal</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefono</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Acceso principal</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol principal</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {canAssignSuperAdmin ? (
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                        ) : (
                          <SelectItem value="super_admin" disabled>
                            Super Admin (solo lectura)
                          </SelectItem>
                        )}
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                        <SelectItem value="tecnico">Tecnico</SelectItem>
                        <SelectItem value="cliente">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Define el nivel base de acceso.</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="inactive">Inactivo</SelectItem>
                        <SelectItem value="suspended">Suspendido</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Departamento</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Acceso a precios mayoristas</h4>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Permite que el cliente vea precios mayoristas en la tienda publica.
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
                Permiso: {WHOLESALE_PRICE_PERMISSION}
              </p>
            </div>
            <Switch
              checked={hasWholesalePermission}
              onCheckedChange={(checked) => {
                const next = setPermission(specificPermissions, WHOLESALE_PRICE_PERMISSION, checked)
                form.setValue('permissions', next, { shouldDirty: true, shouldTouch: true })
              }}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="space-y-4 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Permisos especificos</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{specificPermissions.length} activos</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => form.setValue('permissions', [], { shouldDirty: true, shouldTouch: true })}
              >
                Limpiar extras
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Permisos por rol</p>
              <p className="text-lg font-semibold">{roleEffective.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Permisos efectivos</p>
              <p className="text-lg font-semibold">{effectiveSet.length}</p>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={permissionSearch}
              onChange={(event) => setPermissionSearch(event.target.value)}
              placeholder="Buscar permiso por nombre o codigo"
              className="pl-9"
            />
          </div>

          <div className="grid gap-4">
            {filteredPermissionGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No se encontraron permisos para "{permissionSearch}".
              </div>
            ) : (
              filteredPermissionGroups.map((group) => (
                <div key={group.id} className="rounded-lg border bg-gray-50 p-4 dark:bg-gray-900">
                  <h4 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">{group.label}</h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {group.permissions.map((permission) => {
                      const checked = specificPermissions.includes(permission.id)

                      return (
                        <div key={permission.id} className="flex items-start gap-2">
                          <Checkbox
                            id={`perm-${permission.id}`}
                            checked={checked}
                            onCheckedChange={(value) => {
                              const next = setPermission(specificPermissions, permission.id, Boolean(value))
                              form.setValue('permissions', next, { shouldDirty: true, shouldTouch: true })
                            }}
                          />
                          <div className="grid gap-1 leading-none">
                            <label htmlFor={`perm-${permission.id}`} className="cursor-pointer text-sm font-medium leading-none">
                              {permission.label}
                            </label>
                            <p className="text-[11px] text-muted-foreground">{permission.id}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || !form.formState.isValid || !form.formState.isDirty}>
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
