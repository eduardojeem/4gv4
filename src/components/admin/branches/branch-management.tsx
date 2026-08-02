'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Plus, Pencil, RefreshCw, Store, Users, Wallet, Wrench, Search, MoreVertical, Star, Power, X, Loader2, Eye, Save, AlertTriangle, PackageOpen, Copy } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAuth } from '@/contexts/auth-context'
import type { BranchSummary } from '@/lib/branches/types'
import { BranchDetailDialog } from './branch-detail-dialog'

type BranchFormState = {
  organization_id: string
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
  inventory_mode: 'empty' | 'copy'
  source_branch_id: string
}

const EMPTY_FORM: BranchFormState = {
  organization_id: '',
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
  inventory_mode: 'empty',
  source_branch_id: '',
}

type OrganizationOption = {
  id: string
  name: string
  slug?: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  const { isSuperAdmin } = useAuth()
  const [branches, setBranches] = useState<BranchSummary[]>([])
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchSummary | null>(null)
  const [form, setForm] = useState<BranchFormState>(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState<BranchFormState>(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'revenue' | 'users'>('name')
  const [pendingBranchId, setPendingBranchId] = useState<string | null>(null)
  // Se guarda el id, no el objeto: tras una accion rapida la lista se recarga y
  // el detalle tiene que reflejar el estado nuevo, no la copia del momento en
  // que se abrio.
  const [detailBranchId, setDetailBranchId] = useState<string | null>(null)

  const summary = useMemo(() => ({
    total: branches.length,
    active: branches.filter((branch) => branch.is_active !== false).length,
    users: branches.reduce((sum, branch) => sum + (branch.users_count || 0), 0),
    registers: branches.reduce((sum, branch) => sum + (branch.registers_count || 0), 0),
    openRegisters: branches.reduce((sum, branch) => sum + (branch.open_registers_count || 0), 0),
    revenue: branches.reduce((sum, branch) => sum + (branch.revenue_total || 0), 0),
    sales: branches.reduce((sum, branch) => sum + (branch.sales_count || 0), 0),
  }), [branches])

  // Busqueda, filtro y orden se resuelven en memoria: el endpoint devuelve
  // todas las sucursales de la organizacion y su cantidad es acotada por plan.
  const visibleBranches = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = branches.filter((branch) => {
      if (statusFilter === 'active' && branch.is_active === false) return false
      if (statusFilter === 'inactive' && branch.is_active !== false) return false
      if (!term) return true
      return [branch.name, branch.code, branch.city, branch.manager_name]
        .some((field) => (field || '').toLowerCase().includes(term))
    })

    return [...filtered].sort((left, right) => {
      // La predeterminada siempre primero: es la referencia operativa.
      if (left.is_default !== right.is_default) return left.is_default ? -1 : 1
      if (sortBy === 'revenue') return (right.revenue_total || 0) - (left.revenue_total || 0)
      if (sortBy === 'users') return (right.users_count || 0) - (left.users_count || 0)
      return (left.name || '').localeCompare(right.name || '', 'es')
    })
  }, [branches, search, statusFilter, sortBy])

  const hasActiveFilters = search.trim() !== '' || statusFilter !== 'all'

  const detailBranch = useMemo(
    () => branches.find((branch) => branch.id === detailBranchId) ?? null,
    [branches, detailBranchId]
  )
  const hasFormChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm]
  )
  const isEmailValid = form.email.trim() === '' || EMAIL_RE.test(form.email.trim())
  const canSave = form.name.trim() !== '' && isEmailValid && (!isSuperAdmin || form.organization_id !== '')

  const hydrateForm = useCallback((branch?: BranchSummary | null) => {
    if (!branch) {
      setForm(EMPTY_FORM)
      setInitialForm(EMPTY_FORM)
      setEditingBranch(null)
      return
    }

    const nextForm = {
      organization_id: branch.organization_id || '',
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
      inventory_mode: 'empty' as const,
      source_branch_id: '',
    }
    setEditingBranch(branch)
    setForm(nextForm)
    setInitialForm(nextForm)
  }, [])

  const loadBranches = useCallback(async () => {
    setLoading(true)
    try {
      const searchParams = new URLSearchParams()
      if (isSuperAdmin && selectedOrganizationId) {
        searchParams.set('organizationId', selectedOrganizationId)
      }

      const response = await fetch(
        `/api/admin/branches${searchParams.size > 0 ? `?${searchParams.toString()}` : ''}`,
        { cache: 'no-store' }
      )
      const result = await response.json().catch(() => null) as {
        branches?: BranchSummary[]
        organizations?: OrganizationOption[]
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(result?.error || 'No se pudieron cargar las sucursales.')
      }

      // El detalle se deriva de esta lista, asi que se actualiza solo.
      setBranches(result?.branches || [])
      setOrganizations(result?.organizations || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al cargar sucursales.'
      toast.error(message)
      setBranches([])
      setOrganizations([])
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin, selectedOrganizationId])

  useEffect(() => {
    void loadBranches()
  }, [loadBranches])

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error('El nombre de la sucursal es obligatorio.')
      return
    }

    if (isSuperAdmin && !form.organization_id) {
      toast.error('Selecciona la organizacion de la sucursal.')
      return
    }

    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      toast.error('El email no tiene un formato válido.')
      return
    }

    const { inventory_mode, source_branch_id, ...branchFields } = form
    const payload = {
      ...branchFields,
      code: form.code.trim() || slugify(form.name).slice(0, 12).toUpperCase(),
      slug: form.slug.trim() || slugify(form.name),
      ...(!editingBranch ? {
        inventory_initialization: inventory_mode === 'copy'
          ? { mode: 'copy', source_branch_id }
          : { mode: 'empty' },
      } : {}),
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

      const result = await response.json().catch(() => null) as {
        error?: string
        inventory?: { products_initialized?: number }
      } | null

      if (!response.ok) {
        throw new Error(result?.error || 'No se pudo guardar la sucursal.')
      }

      toast.success(editingBranch
        ? 'Sucursal actualizada.'
        : `Sucursal creada con ${result?.inventory?.products_initialized || 0} productos inicializados.`)
      setDialogOpen(false)
      hydrateForm(null)
      await loadBranches()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al guardar la sucursal.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }, [editingBranch, form, hydrateForm, isSuperAdmin, loadBranches])

  const openCreate = useCallback(() => {
    hydrateForm(null)
    if (isSuperAdmin && selectedOrganizationId) {
      const nextForm = { ...EMPTY_FORM, organization_id: selectedOrganizationId }
      setForm(nextForm)
      setInitialForm(nextForm)
    }
    setDialogOpen(true)
  }, [hydrateForm, isSuperAdmin, selectedOrganizationId])

  const handleEditorOpenChange = useCallback((open: boolean) => {
    if (open) {
      setDialogOpen(true)
      return
    }

    if (saving) return
    if (hasFormChanges && !window.confirm('Hay cambios sin guardar. ¿Querés cerrar igualmente?')) return
    setDialogOpen(false)
    hydrateForm(null)
  }, [hasFormChanges, hydrateForm, saving])

  /**
   * Cambios puntuales sin abrir el diálogo. El backend rechaza con 409 quitar
   * la última sucursal activa o desactivar la predeterminada, y ese mensaje se
   * muestra tal cual porque ya explica qué hacer primero.
   */
  const quickPatch = useCallback(async (
    branch: BranchSummary,
    patch: Record<string, unknown>,
    successMessage: string
  ) => {
    setPendingBranchId(branch.id)
    try {
      const response = await fetch(`/api/admin/branches/${branch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null

      if (!response.ok) {
        throw new Error(result?.error || 'No se pudo actualizar la sucursal.')
      }

      toast.success(successMessage)
      await loadBranches()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la sucursal.')
    } finally {
      setPendingBranchId(null)
    }
  }, [loadBranches])

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

  const inventorySourceBranches = useMemo(() => {
    const organizationId = form.organization_id || selectedOrganizationId
    return branches.filter((branch) =>
      branch.is_active !== false &&
      (!organizationId || branch.organization_id === organizationId)
    )
  }, [branches, form.organization_id, selectedOrganizationId])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sucursales</h1>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin
              ? 'Vista global de sucursales por organizacion. Cada alta debe quedar asociada a una empresa.'
              : 'Base operativa para aislar ventas, cajas, reparaciones y trazabilidad por sede.'}
          </p>
        </div>

        {isSuperAdmin ? (
          <div className="min-w-[260px] space-y-2">
            <Label htmlFor="branches-organization-filter">Empresa</Label>
            <Select
              value={selectedOrganizationId}
              onValueChange={(value) => setSelectedOrganizationId(value)}
            >
              <SelectTrigger id="branches-organization-filter" className="w-full">
                <SelectValue placeholder="Selecciona una empresa" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadBranches()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Dialog open={dialogOpen} onOpenChange={handleEditorOpenChange}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} disabled={isSuperAdmin && !selectedOrganizationId}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva sucursal
              </Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[92vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none">
              <DialogHeader className="shrink-0 space-y-0 border-b bg-muted/20 px-5 py-4 pr-12 text-left sm:px-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
                    {editingBranch ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="truncate text-lg">
                      {editingBranch ? `Editar ${editingBranch.name}` : 'Crear sucursal'}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      {editingBranch
                        ? 'Actualizá los datos que identifican y habilitan esta sede.'
                        : 'Configurá la identidad, el contacto y el estado inicial de la nueva sede.'}
                    </DialogDescription>
                  </div>
                  {editingBranch ? (
                    <Badge variant={form.is_active ? 'default' : 'destructive'} className="hidden sm:inline-flex">
                      {form.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  ) : null}
                </div>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              {editingBranch ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                  <span className="font-medium">{editingBranch.code}</span>
                  <span className="text-muted-foreground">{editingBranch.city || 'Ciudad sin configurar'}</span>
                  <span className="text-muted-foreground">{editingBranch.users_count || 0} usuarios asignados</span>
                </div>
              ) : null}
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Identidad
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {isSuperAdmin ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="branch-organization">Organizacion</Label>
                    <Select
                      value={form.organization_id}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, organization_id: value }))}
                      disabled={Boolean(editingBranch)}
                    >
                      <SelectTrigger id="branch-organization" className="w-full">
                        <SelectValue placeholder="Selecciona una organizacion" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((organization) => (
                          <SelectItem key={organization.id} value={organization.id}>
                            {organization.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="branch-name">Nombre <span className="text-destructive">*</span></Label>
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
                  <p className="text-xs text-muted-foreground">Se genera del nombre si lo dejás vacío. Único por empresa.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch-slug">Slug</Label>
                  <Input
                    id="branch-slug"
                    value={form.slug}
                    onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                    placeholder="casa-central"
                  />
                  <p className="text-xs text-muted-foreground">Identificador para URLs. También único por empresa.</p>
                </div>
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Ubicación y contacto
              </p>
              <div className="grid gap-4 sm:grid-cols-2">

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
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="sucursal@empresa.com"
                    aria-invalid={form.email.trim() !== '' && !EMAIL_RE.test(form.email.trim())}
                  />
                  {form.email.trim() !== '' && !EMAIL_RE.test(form.email.trim()) ? (
                    <p className="text-xs text-destructive">Formato de email inválido.</p>
                  ) : null}
                </div>
              </div>

              {!editingBranch ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Inventario inicial
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      El catalogo es compartido por la empresa. Esta opcion define solamente el stock de la nueva sucursal.
                    </p>
                  </div>

                  <RadioGroup
                    value={form.inventory_mode}
                    onValueChange={(value) => setForm((prev) => ({
                      ...prev,
                      inventory_mode: value as 'empty' | 'copy',
                      source_branch_id: value === 'copy' ? prev.source_branch_id : '',
                    }))}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <Label
                      htmlFor="branch-inventory-empty"
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        form.inventory_mode === 'empty' && 'border-primary bg-primary/5'
                      )}
                    >
                      <RadioGroupItem id="branch-inventory-empty" value="empty" className="mt-0.5" />
                      <PackageOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="block text-sm font-medium">Comenzar con stock 0</span>
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">
                          Crea todos los productos sin existencias para cargarlas luego.
                        </span>
                      </span>
                    </Label>

                    <Label
                      htmlFor="branch-inventory-copy"
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        form.inventory_mode === 'copy' && 'border-primary bg-primary/5',
                        inventorySourceBranches.length === 0 && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      <RadioGroupItem
                        id="branch-inventory-copy"
                        value="copy"
                        className="mt-0.5"
                        disabled={inventorySourceBranches.length === 0}
                      />
                      <Copy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="block text-sm font-medium">Copiar otra sucursal</span>
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">
                          Replica las cantidades actuales como punto de partida.
                        </span>
                      </span>
                    </Label>
                  </RadioGroup>

                  {form.inventory_mode === 'copy' ? (
                    <div className="space-y-2">
                      <Label htmlFor="branch-inventory-source">Sucursal de origen</Label>
                      <Select
                        value={form.source_branch_id}
                        onValueChange={(value) => setForm((prev) => ({ ...prev, source_branch_id: value }))}
                      >
                        <SelectTrigger id="branch-inventory-source" className="w-full">
                          <SelectValue placeholder="Selecciona la sucursal que queres copiar" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventorySourceBranches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name} {branch.city ? `- ${branch.city}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        La copia no vincula los inventarios: despues podras ajustar cada sucursal por separado.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Estado
              </p>
              <div className="grid gap-4 sm:grid-cols-2">

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="branch-active" className="text-sm font-medium">Activa</Label>
                    <p className="text-xs text-muted-foreground">
                      {editingBranch?.is_default
                        ? 'Primero definí otra sucursal como predeterminada.'
                        : 'Disponible para operación diaria.'}
                    </p>
                  </div>
                  <Switch
                    id="branch-active"
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
                    disabled={editingBranch?.is_default === true}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="branch-default" className="text-sm font-medium">Predeterminada</Label>
                    <p className="text-xs text-muted-foreground">
                      {editingBranch?.is_default
                        ? 'Para cambiarla, marcá otra sucursal desde el listado.'
                        : 'Se usa cuando una operación no especifica una sede.'}
                    </p>
                  </div>
                  <Switch
                    id="branch-default"
                    checked={form.is_default}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_default: checked }))}
                    disabled={editingBranch?.is_default === true}
                  />
                </div>
              </div>
              {editingBranch?.is_default ? (
                <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p>Esta es la sede predeterminada. Para desactivarla, primero marcá otra sucursal como principal desde el listado.</p>
                </div>
              ) : null}
              </div>

              <DialogFooter className="shrink-0 border-t bg-muted/20 px-5 py-4 sm:px-6">
                <span className="mr-auto hidden items-center text-xs text-muted-foreground sm:flex">
                  {hasFormChanges ? 'Tenés cambios pendientes' : 'Sin cambios pendientes'}
                </span>
                <Button
                  variant="outline"
                  onClick={() => handleEditorOpenChange(false)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={
                    saving ||
                    !canSave ||
                    (!editingBranch && form.inventory_mode === 'copy' && !form.source_branch_id) ||
                    (Boolean(editingBranch) && !hasFormChanges)
                  }
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
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
                <CardDescription>Sucursales</CardDescription>
                <CardTitle className="text-3xl">{summary.total}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {summary.active} activa{summary.active === 1 ? '' : 's'}
                  {summary.total - summary.active > 0 ? ` · ${summary.total - summary.active} inactiva${summary.total - summary.active === 1 ? '' : 's'}` : ''}
                </p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Usuarios asignados</CardDescription>
                <CardTitle className="text-3xl">{summary.users}</CardTitle>
                <p className="text-xs text-muted-foreground">En todas las sucursales</p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Cajas</CardDescription>
                <CardTitle className="text-3xl">{summary.registers}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {summary.openRegisters} abierta{summary.openRegisters === 1 ? '' : 's'} ahora
                </p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Facturación del mes</CardDescription>
                <CardTitle className="text-3xl">{toCurrency(summary.revenue)}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {summary.sales} venta{summary.sales === 1 ? '' : 's'}
                </p>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      {/* Barra de control: buscar, filtrar y ordenar sin perder de vista el total */}
      {!loading && branches.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, código, ciudad o encargado…"
              className="h-9 pl-9 pr-8 text-sm"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className="h-9 w-[150px] text-sm">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="active">Solo activas</SelectItem>
              <SelectItem value="inactive">Solo inactivas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
            <SelectTrigger className="h-9 w-[170px] text-sm">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nombre (A-Z)</SelectItem>
              <SelectItem value="revenue">Mayor facturación</SelectItem>
              <SelectItem value="users">Más usuarios</SelectItem>
            </SelectContent>
          </Select>

          <span className="ml-auto text-xs text-muted-foreground">
            {visibleBranches.length} de {branches.length} sucursal{branches.length === 1 ? '' : 'es'}
          </span>

          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => { setSearch(''); setStatusFilter('all') }}
            >
              <X className="h-3.5 w-3.5" />
              Limpiar
            </Button>
          ) : null}
        </div>
      ) : null}

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
                <p className="text-lg font-semibold">
                  {isSuperAdmin && !selectedOrganizationId
                    ? 'Selecciona una empresa para ver sus sucursales'
                    : 'Todavia no hay sucursales configuradas'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isSuperAdmin && !selectedOrganizationId
                    ? 'La vista operativa se mantiene filtrada por empresa para evitar mezclar datos.'
                    : 'Crea la primera sucursal para empezar a segmentar ventas, cajas y reparaciones.'}
                </p>
              </div>
              {isSuperAdmin && !selectedOrganizationId ? null : (
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primera sucursal
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          visibleBranches.map((branch) => {
            const isInactive = branch.is_active === false
            const isPending = pendingBranchId === branch.id
            return (
            <Card
              key={branch.id}
              className={cn(
                'overflow-hidden transition-colors',
                branch.is_default
                  ? 'border-primary/40 ring-1 ring-primary/15'
                  : 'border-border/70',
                isInactive && 'opacity-70'
              )}
            >
              <CardHeader className={cn('border-b', branch.is_default ? 'bg-primary/5' : 'bg-muted/20')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Store className={cn('h-5 w-5', branch.is_default ? 'text-primary' : 'text-muted-foreground')} />
                      {branch.name}
                    </CardTitle>
                    <CardDescription>
                      {branch.code} {branch.city ? ` - ${branch.city}` : ''} {branch.manager_name ? ` - ${branch.manager_name}` : ''}
                    </CardDescription>
                    {isSuperAdmin && branch.organization ? (
                      <Badge variant="outline" className="w-fit">
                        {branch.organization.name}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {branch.is_default ? (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3" />
                        Predeterminada
                      </Badge>
                    ) : null}
                    <Badge variant={isInactive ? 'destructive' : 'default'}>
                      {isInactive ? 'Inactiva' : 'Activa'}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => setDetailBranchId(branch.id)} disabled={isPending}>
                      <Eye className="mr-2 h-4 w-4" />
                      Ver detalle
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          disabled={isPending}
                          aria-label={`Más acciones para ${branch.name}`}
                        >
                          {isPending
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <MoreVertical className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => openEdit(branch)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar sucursal
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={branch.is_default || isInactive}
                          onClick={() => void quickPatch(branch, { is_default: true }, `${branch.name} es ahora la sucursal predeterminada.`)}
                        >
                          <Star className="mr-2 h-4 w-4" />
                          {branch.is_default ? 'Ya es predeterminada' : 'Marcar predeterminada'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => void quickPatch(
                            branch,
                            { is_active: isInactive },
                            isInactive ? `${branch.name} fue activada.` : `${branch.name} fue desactivada.`
                          )}
                          className={isInactive ? undefined : 'text-destructive focus:text-destructive'}
                        >
                          <Power className="mr-2 h-4 w-4" />
                          {isInactive ? 'Activar sucursal' : 'Desactivar sucursal'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
            )
          })
        )}

        {!loading && branches.length > 0 && visibleBranches.length === 0 ? (
          <Card className="xl:col-span-2">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="rounded-2xl bg-muted p-4 text-muted-foreground">
                <Search className="h-7 w-7" />
              </div>
              <div>
                <p className="text-base font-semibold">Ninguna sucursal coincide</p>
                <p className="text-sm text-muted-foreground">
                  Probá con otro término o cambiá el filtro de estado.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('all') }}>
                <X className="mr-2 h-4 w-4" />
                Limpiar filtros
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <BranchDetailDialog
        branch={detailBranch}
        open={Boolean(detailBranch)}
        onOpenChange={(open) => { if (!open) setDetailBranchId(null) }}
        isSuperAdmin={isSuperAdmin}
        isPending={pendingBranchId === detailBranch?.id}
        onEdit={(branch) => { setDetailBranchId(null); openEdit(branch) }}
        onSetDefault={(branch) => void quickPatch(branch, { is_default: true }, `${branch.name} es ahora la sucursal predeterminada.`)}
        onToggleActive={(branch) => void quickPatch(
          branch,
          { is_active: branch.is_active === false },
          branch.is_active === false ? `${branch.name} fue activada.` : `${branch.name} fue desactivada.`
        )}
      />
    </div>
  )
}
