'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Plus, Pencil, RefreshCw, Store, Users, Wallet, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import type { BranchSummary } from '@/lib/branches/types'

type BranchFormState = {
  name: string
  code: string
  slug: string
  address: string
  city: string
  phone: string
  email: string
  manager_name: string
  is_active: boolean
  is_default: boolean
}

const EMPTY_FORM: BranchFormState = {
  name: '',
  code: '',
  slug: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  manager_name: '',
  is_active: true,
  is_default: false,
}

function toCurrency(value: number | undefined) {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function BranchManagement() {
  const [branches, setBranches] = useState<BranchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchSummary | null>(null)
  const [form, setForm] = useState<BranchFormState>(EMPTY_FORM)

  const summary = useMemo(() => ({
    total: branches.length,
    active: branches.filter((branch) => branch.is_active !== false).length,
    users: branches.reduce((sum, branch) => sum + (branch.users_count || 0), 0),
    registers: branches.reduce((sum, branch) => sum + (branch.registers_count || 0), 0),
  }), [branches])

  const hydrateForm = useCallback((branch?: BranchSummary | null) => {
    if (!branch) {
      setForm(EMPTY_FORM)
      setEditingBranch(null)
      return
    }

    setEditingBranch(branch)
    setForm({
      name: branch.name || '',
      code: branch.code || '',
      slug: branch.slug || '',
      address: branch.address || '',
      city: branch.city || '',
      phone: branch.phone || '',
      email: branch.email || '',
      manager_name: branch.manager_name || '',
      is_active: branch.is_active !== false,
      is_default: branch.is_default === true,
    })
  }, [])

  const loadBranches = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/branches', { cache: 'no-store' })
      const result = await response.json().catch(() => null) as { branches?: BranchSummary[]; error?: string } | null

      if (!response.ok) {
        throw new Error(result?.error || 'No se pudieron cargar las sucursales.')
      }

      setBranches(result?.branches || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al cargar sucursales.'
      toast.error(message)
      setBranches([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBranches()
  }, [loadBranches])

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error('El nombre de la sucursal es obligatorio.')
      return
    }

    const payload = {
      ...form,
      code: form.code.trim() || slugify(form.name).slice(0, 12).toUpperCase(),
      slug: form.slug.trim() || slugify(form.name),
    }

    setSaving(true)
    try {
      const endpoint = editingBranch
        ? `/api/admin/branches/${editingBranch.id}`
        : '/api/admin/branches'

      const response = await fetch(endpoint, {
        method: editingBranch ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => null) as { error?: string } | null

      if (!response.ok) {
        throw new Error(result?.error || 'No se pudo guardar la sucursal.')
      }

      toast.success(editingBranch ? 'Sucursal actualizada.' : 'Sucursal creada.')
      setDialogOpen(false)
      hydrateForm(null)
      await loadBranches()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al guardar la sucursal.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }, [editingBranch, form, hydrateForm, loadBranches])

  const openCreate = useCallback(() => {
    hydrateForm(null)
    setDialogOpen(true)
  }, [hydrateForm])

  const openEdit = useCallback((branch: BranchSummary) => {
    hydrateForm(branch)
    setDialogOpen(true)
  }, [hydrateForm])

  const handleNameChange = useCallback((name: string) => {
    setForm((prev) => {
      const nextSlug = prev.slug.trim().length > 0 ? prev.slug : slugify(name)
      const nextCode = prev.code.trim().length > 0 ? prev.code : slugify(name).slice(0, 12).toUpperCase()

      return {
        ...prev,
        name,
        slug: nextSlug,
        code: nextCode,
      }
    })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sucursales</h1>
          <p className="text-sm text-muted-foreground">
            Base operativa para aislar ventas, cajas, reparaciones y trazabilidad por sede.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadBranches()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva sucursal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingBranch ? 'Editar sucursal' : 'Crear sucursal'}</DialogTitle>
                <DialogDescription>
                  Define identidad operativa, estado y metadatos base para aislar flujos por sede.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="branch-name">Nombre</Label>
                  <Input
                    id="branch-name"
                    value={form.name}
                    onChange={(event) => handleNameChange(event.target.value)}
                    placeholder="Casa Central"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch-code">Código</Label>
                  <Input
                    id="branch-code"
                    value={form.code}
                    onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                    placeholder="CENTRAL"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch-slug">Slug</Label>
                  <Input
                    id="branch-slug"
                    value={form.slug}
                    onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                    placeholder="casa-central"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="branch-address">Dirección</Label>
                  <Input
                    id="branch-address"
                    value={form.address}
                    onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                    placeholder="Av. Principal 123"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch-city">Ciudad</Label>
                  <Input
                    id="branch-city"
                    value={form.city}
                    onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                    placeholder="Asunción"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch-manager">Responsable</Label>
                  <Input
                    id="branch-manager"
                    value={form.manager_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, manager_name: event.target.value }))}
                    placeholder="Encargado de sucursal"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch-phone">Teléfono</Label>
                  <Input
                    id="branch-phone"
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="+595..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch-email">Email</Label>
                  <Input
                    id="branch-email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="sucursal@empresa.com"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-medium">Activa</p>
                    <p className="text-xs text-muted-foreground">Disponible para operación diaria.</p>
                  </div>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-medium">Predeterminada</p>
                    <p className="text-xs text-muted-foreground">Fallback para migración y operaciones legadas.</p>
                  </div>
                  <Switch
                    checked={form.is_default}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_default: checked }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false)
                    hydrateForm(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={() => void handleSubmit()} disabled={saving}>
                  {saving ? 'Guardando...' : editingBranch ? 'Guardar cambios' : 'Crear sucursal'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Sucursales registradas</CardDescription>
                <CardTitle className="text-3xl">{summary.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Sucursales activas</CardDescription>
                <CardTitle className="text-3xl">{summary.active}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Usuarios asignados</CardDescription>
                <CardTitle className="text-3xl">{summary.users}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Cajas registradas</CardDescription>
                <CardTitle className="text-3xl">{summary.registers}</CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {loading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-[280px] rounded-2xl" />
          ))
        ) : branches.length === 0 ? (
          <Card className="xl:col-span-2">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <div className="rounded-2xl bg-primary/10 p-4 text-primary">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-semibold">Todavía no hay sucursales configuradas</p>
                <p className="text-sm text-muted-foreground">
                  Crea la primera sucursal para empezar a segmentar ventas, cajas y reparaciones.
                </p>
              </div>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Crear primera sucursal
              </Button>
            </CardContent>
          </Card>
        ) : (
          branches.map((branch) => (
            <Card key={branch.id} className="overflow-hidden border-border/70">
              <CardHeader className="border-b bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Store className="h-5 w-5 text-primary" />
                      {branch.name}
                    </CardTitle>
                    <CardDescription>
                      {branch.code} {branch.city ? `• ${branch.city}` : ''} {branch.manager_name ? `• ${branch.manager_name}` : ''}
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {branch.is_default ? <Badge variant="secondary">Predeterminada</Badge> : null}
                    <Badge variant={branch.is_active === false ? 'destructive' : 'default'}>
                      {branch.is_active === false ? 'Inactiva' : 'Activa'}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => openEdit(branch)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 pt-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      Usuarios
                    </div>
                    <p className="mt-2 text-2xl font-semibold">{branch.users_count || 0}</p>
                    <p className="text-xs text-muted-foreground">{branch.primary_users_count || 0} primarios</p>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <Store className="h-3.5 w-3.5" />
                      Cajas
                    </div>
                    <p className="mt-2 text-2xl font-semibold">{branch.registers_count || 0}</p>
                    <p className="text-xs text-muted-foreground">{branch.open_registers_count || 0} abiertas</p>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" />
                      Ventas del mes
                    </div>
                    <p className="mt-2 text-2xl font-semibold">{branch.sales_count || 0}</p>
                    <p className="text-xs text-muted-foreground">{toCurrency(branch.revenue_total)}</p>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <Wrench className="h-3.5 w-3.5" />
                      Reparaciones
                    </div>
                    <p className="mt-2 text-2xl font-semibold">{branch.repairs_count || 0}</p>
                    <p className="text-xs text-muted-foreground">Carga operativa visible</p>
                  </div>
                </div>

                <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <div className="rounded-xl border p-3">
                    <p className="font-medium text-foreground">Contacto</p>
                    <p>{branch.phone || 'Sin teléfono configurado'}</p>
                    <p>{branch.email || 'Sin email configurado'}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="font-medium text-foreground">Ubicación</p>
                    <p>{branch.address || 'Sin dirección configurada'}</p>
                    <p>{branch.city || 'Ciudad no definida'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
