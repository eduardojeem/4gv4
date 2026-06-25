'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Search, Mail, Lock, User as UserIcon, ShieldCheck, KeyRound, Eraser, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import type { SupabaseUser } from '@/hooks/use-users-supabase'
import { PERMISSION_GROUPS } from './permissions'
import { ROLE_PERMISSIONS, WHOLESALE_PRICE_PERMISSION, PRODUCT_COST_PERMISSION } from '@/lib/auth/roles-permissions'
import { BranchAssignment } from './BranchAssignment'
import { UserAvatarUpload } from './user-avatar-upload'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().optional(),
  role: z.enum(['super_admin', 'admin', 'vendedor', 'tecnico', 'cliente']),
  status: z.enum(['active', 'inactive', 'suspended']),
  department: z.string().optional(),
  permissions: z.array(z.string()).default([]),
})

type FormValues = z.infer<typeof schema>

const ROLE_LABELS: Record<FormValues['role'], string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  vendedor: 'Vendedor',
  tecnico: 'Técnico',
  cliente: 'Cliente',
}

const STATUS_STYLES: Record<FormValues['status'], string> = {
  active: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
  inactive: 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
  suspended: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300',
}

const STATUS_LABELS: Record<FormValues['status'], string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
}

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

function SectionHeading({ icon: Icon, children, className }: { icon: typeof UserIcon; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-3 pb-3 border-b border-slate-200/50 dark:border-slate-800/50 ${className || ''}`}>
      <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{children}</h3>
    </div>
  )
}

export function EditUserForm({
  user,
  isSubmitting,
  onSubmit,
  onCancel,
  canAssignSuperAdmin = false,
  onAvatarUpload,
  isLoadingPermissions = false,
}: {
  user: SupabaseUser
  isSubmitting: boolean
  onSubmit: (values: FormValues) => Promise<void>
  onCancel: () => void
  canAssignSuperAdmin?: boolean
  onAvatarUpload?: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>
  isLoadingPermissions?: boolean
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
  const status = useWatch({ control: form.control, name: 'status' })
  const specificPermissions = useWatch({ control: form.control, name: 'permissions' }) || []

  const roleEffective = useMemo(() => {
    const roleConfig = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]
    return roleConfig ? roleConfig.permissions.map((permission) => permission.id) : []
  }, [role])

  const effectiveSet = useMemo(() => {
    return Array.from(new Set([...roleEffective, ...specificPermissions]))
  }, [roleEffective, specificPermissions])

  const hasWholesalePermission = specificPermissions.includes(WHOLESALE_PRICE_PERMISSION)
  const hasCostPermission = specificPermissions.includes(PRODUCT_COST_PERMISSION)

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

  const isDirty = form.formState.isDirty

  const handleSubmit = form.handleSubmit(async (values) => {
    const dirtyFields = form.formState.dirtyFields as Record<string, unknown>
    const payload: Record<string, unknown> = {}

    Object.entries(dirtyFields).forEach(([key, dirty]) => {
      if (dirty) {
        payload[key] = (values as Record<string, unknown>)[key]
      }
    })

    if (Object.keys(payload).length === 0) return

    await onSubmit(payload as FormValues)
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col bg-slate-50/30 dark:bg-slate-950/20">
        {/* Scrollable body */}
        <div className="flex-1 space-y-8 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar">
          {/* Identity header */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 p-6 shadow-sm backdrop-blur-md">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 opacity-70" />
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
              <UserAvatarUpload
                userName={user.name}
                currentAvatarUrl={user.avatar_url}
                onUpload={onAvatarUpload ?? (async () => ({ success: false, error: 'No disponible' }))}
              />
              <div className="min-w-0 flex-1 text-center sm:text-left space-y-1.5">
                <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-white break-words">{user.name || 'Sin nombre'}</p>
                <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-2 sm:gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2 break-all">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>{user.email}</span>
                    <Lock className="h-3 w-3 shrink-0 opacity-50" />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <Badge variant="outline" className="px-2.5 py-0.5 font-medium border shadow-sm bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
                    {ROLE_LABELS[role as FormValues['role']] ?? role}
                  </Badge>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-sm ${STATUS_STYLES[status as FormValues['status']] ?? ''}`}>
                    {STATUS_LABELS[status as FormValues['status']] ?? status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {isLoadingPermissions && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando permisos específicos...
            </div>
          )}

          {/* Información personal */}
          <section className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/30 p-5 shadow-sm space-y-4">
            <SectionHeading icon={UserIcon}>Información personal</SectionHeading>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 pt-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 dark:text-slate-300">Nombre completo</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nombre y apellido" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
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
                    <FormLabel className="text-slate-700 dark:text-slate-300">Teléfono</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+595 ..." className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Acceso principal */}
          <section className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/30 p-5 shadow-sm space-y-4">
            <SectionHeading icon={ShieldCheck}>Acceso principal</SectionHeading>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 pt-2">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 dark:text-slate-300">Rol principal</FormLabel>
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
                          <SelectItem value="tecnico">Técnico</SelectItem>
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
                    <FormLabel className="text-slate-700 dark:text-slate-300">Estado</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
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

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 dark:text-slate-300">Departamento</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Opcional" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Branch Assignment - only for staff roles */}
            <div className="pt-2">
              <BranchAssignment userId={user.id} userRole={role} />
            </div>
          </section>

          {/* Precios mayoristas */}
          <section>
            <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-900/10 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Acceso a precios mayoristas</h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Permite que el cliente vea precios mayoristas en la tienda pública.
                  </p>
                  <p className="text-[11px] font-mono text-amber-700/80 dark:text-amber-300/80">
                    {WHOLESALE_PRICE_PERMISSION}
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
          </section>

          {/* Precios de costo */}
          <section>
            <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-5 dark:border-emerald-900/40 dark:bg-emerald-900/10 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Ver precios de costo</h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Permite ver el costo y el margen de los productos. Los administradores ya lo ven siempre.
                  </p>
                  <p className="text-[11px] font-mono text-emerald-700/80 dark:text-emerald-300/80">
                    {PRODUCT_COST_PERMISSION}
                  </p>
                </div>
                <Switch
                  checked={hasCostPermission}
                  onCheckedChange={(checked) => {
                    const next = setPermission(specificPermissions, PRODUCT_COST_PERMISSION, checked)
                    form.setValue('permissions', next, { shouldDirty: true, shouldTouch: true })
                  }}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </section>

          {/* Permisos específicos */}
          <section className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/30 p-5 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionHeading icon={KeyRound} className="border-none pb-0">Permisos específicos</SectionHeading>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-normal border-slate-200 dark:border-slate-700">{specificPermissions.length} extras</Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                  disabled={specificPermissions.length === 0}
                  onClick={() => form.setValue('permissions', [], { shouldDirty: true, shouldTouch: true })}
                >
                  <Eraser className="mr-1.5 h-3.5 w-3.5" />
                  Limpiar extras
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 p-4 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Por rol</p>
                  <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{roleEffective.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-slate-400" />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 p-4 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Efectivos</p>
                  <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{effectiveSet.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                  <KeyRound className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </div>

            <div className="relative border-t border-slate-100 dark:border-slate-800/50 pt-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 mt-2.5 text-slate-400" />
              <Input
                value={permissionSearch}
                onChange={(event) => setPermissionSearch(event.target.value)}
                placeholder="Buscar permiso por nombre o código..."
                className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>

            <div className="grid gap-4">
              {filteredPermissionGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
                  <Search className="h-8 w-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  No se encontraron permisos para &quot;<span className="text-slate-700 dark:text-slate-300">{permissionSearch}</span>&quot;.
                </div>
              ) : (
                filteredPermissionGroups.map((group) => (
                  <div key={group.id} className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-950/40 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-foreground">{group.label}</h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {group.permissions.map((permission) => {
                        const checked = specificPermissions.includes(permission.id)
                        const fromRole = roleEffective.includes(permission.id)

                        return (
                          <label
                            key={permission.id}
                            htmlFor={`perm-${permission.id}`}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all duration-200 ${
                              checked || fromRole
                                ? "border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-900/10 shadow-sm" 
                                : "border-slate-200/60 bg-white dark:border-slate-800/60 dark:bg-slate-950 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm"
                            }`}
                          >
                            <Checkbox
                              id={`perm-${permission.id}`}
                              checked={checked}
                              className="mt-0.5 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                              onCheckedChange={(value) => {
                                const next = setPermission(specificPermissions, permission.id, Boolean(value))
                                form.setValue('permissions', next, { shouldDirty: true, shouldTouch: true })
                              }}
                            />
                            <div className="grid gap-0.5 leading-none">
                              <span className="flex items-center gap-1.5 text-sm font-medium leading-tight">
                                {permission.label}
                                {fromRole && (
                                  <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
                                    rol
                                  </span>
                                )}
                              </span>
                              <span className="font-mono text-[11px] text-muted-foreground">{permission.id}</span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 z-20 flex items-center justify-between gap-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md px-6 py-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
            {isDirty ? 'Tienes cambios sin guardar' : 'No hay cambios pendientes'}
          </p>
          <div className="flex flex-1 sm:flex-none gap-3">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1 sm:flex-none border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !form.formState.isValid || !isDirty} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white shadow-md">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Guardando...' : !isDirty ? 'Sin cambios' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
