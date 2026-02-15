'use client'

import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import type { SupabaseUser } from '@/hooks/use-users-supabase'
import { PERMISSION_GROUPS } from './permissions'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().optional(),
  role: z.enum(['admin','supervisor','vendedor','tecnico','cliente']),
  status: z.enum(['active','inactive','suspended']),
  department: z.string().optional(),
  permissions: z.array(z.string()).default([]),
})

type FormValues = z.infer<typeof schema>

export function EditUserForm({
  user,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  user: SupabaseUser
  isSubmitting: boolean
  onSubmit: (values: FormValues) => Promise<void>
  onCancel: () => void
}) {
  const defaultValues: FormValues = useMemo(() => ({
    name: user.name || '',
    phone: user.phone || '',
    role: (user.role as FormValues['role']) || 'cliente',
    status: (user.status as FormValues['status']) || 'active',
    department: user.department || '',
    permissions: user.permissions || [],
  }), [user])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues,
    mode: 'onChange',
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    const df = form.formState.dirtyFields as Record<string, any>
    const payload: Partial<FormValues> = {}
    Object.keys(df).forEach((k) => {
      if (df[k]) (payload as any)[k] = (values as any)[k]
    })
    await onSubmit(payload as FormValues)
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="grid gap-6 py-4">
        {/* Información Personal */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Información Personal</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo</FormLabel>
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
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Control de Acceso */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Control de Acceso</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol Principal</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
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

        {/* Permisos */}
        <div className="space-y-4 pt-2 border-t">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Permisos Específicos</h3>
            <span className="text-xs text-muted-foreground">
              {form.watch('permissions').length} activos
            </span>
          </div>

          <div className="grid gap-4">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border">
                <h4 className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">
                  {group.label}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.permissions.map((perm) => {
                    const checked = form.watch('permissions').includes(perm.id)
                    return (
                      <div key={perm.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={`perm-${perm.id}`}
                          checked={checked}
                          onCheckedChange={(c) => {
                            const current = form.getValues('permissions')
                            form.setValue(
                              'permissions',
                              c ? [...current, perm.id] : current.filter((p) => p !== perm.id),
                              { shouldDirty: true, shouldTouch: true }
                            )
                          }}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label htmlFor={`perm-${perm.id}`} className="text-sm font-medium leading-none cursor-pointer">
                            {perm.label}
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting || !form.formState.isValid}>
            {isSubmitting ? 'Guardando…' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
