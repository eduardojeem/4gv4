'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BadgeCheck,
  Building2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit,
  Link2,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useBrands, type Brand } from '@/hooks/useBrands'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { BRANDS_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { BrandModal } from '@/components/dashboard/brands/BrandModal'
import { BrandDetailModal } from '@/components/dashboard/brands/BrandDetailModal'
import { BrandMark } from '@/components/dashboard/brands/BrandMark'
import { BrandCatalogDialog } from '@/components/dashboard/brands/BrandCatalogDialog'
import { RouteGuard } from '@/components/auth/permission-guard'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'

type StatusFilter = 'all' | 'active' | 'inactive'
type LinkFilter = 'all' | 'official' | 'own'

type LinkSuggestion = { id: string; name: string; global_brand_id: string; official_name: string; logo_url: string | null }

const toSafeWebsiteHref = (raw?: string | null) => {
  const value = raw?.trim()
  if (!value) return null
  return /^https?:\/\//i.test(value) ? value : null
}

export default function BrandsPage() {
  const {
    brands,
    totalCount,
    loading,
    error,
    filters,
    fetchBrands,
    createBrand,
    updateBrand,
    deleteBrand,
  } = useBrands()

  const [isModalOpen, setIsModalOpen] = useState(false)
  // Las oficiales se agregan desde el catálogo (varias a la vez); las propias,
  // con el modal en modo propio. Antes un solo «Nueva marca» mezclaba las dos.
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [createMode, setCreateMode] = useState<'official' | 'own'>('official')
  const [createName, setCreateName] = useState('')
  const [editingBrand, setEditingBrand] = useState<Brand | undefined>(undefined)
  const [selectedDetailBrand, setSelectedDetailBrand] = useState<Brand | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all')
  const [linkSuggestions, setLinkSuggestions] = useState<LinkSuggestion[]>([])
  const [linking, setLinking] = useState(false)

  const [searchTerm, setSearchTerm] = useState(filters.search ?? '')
  const debouncedSearch = useDebounce(searchTerm, 400)

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      void fetchBrands({ search: debouncedSearch, page: 1 })
    }
  }, [debouncedSearch, fetchBrands, filters.search])

  // Marcas propias que tienen una oficial con el mismo nombre.
  const loadSuggestions = useCallback(async () => {
    try {
      const response = await fetch('/api/brands/link', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      setLinkSuggestions(payload?.success ? payload.data ?? [] : [])
    } catch {
      setLinkSuggestions([])
    }
  }, [])

  useEffect(() => { void loadSuggestions() }, [loadSuggestions])

  const refresh = async () => {
    await Promise.all([fetchBrands(), loadSuggestions()])
  }

  const applyStatusFilter = (value: StatusFilter) => {
    setStatusFilter(value)
    void fetchBrands({ isActive: value === 'all' ? undefined : value === 'active', page: 1 })
  }

  const applyLinkFilter = (value: LinkFilter) => {
    setLinkFilter(value)
    void fetchBrands({ linked: value === 'all' ? undefined : value, page: 1 })
  }

  const handleLinkAll = async () => {
    setLinking(true)
    try {
      const response = await fetch('/api/brands/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: linkSuggestions.map((row) => row.id) }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudieron vincular.')
      toast.success(`${payload.linked} marca${payload.linked === 1 ? '' : 's'} vinculada${payload.linked === 1 ? '' : 's'} al catálogo`, {
        description: payload.skipped ? `${payload.skipped} no se pudieron vincular: revisalas a mano.` : 'Ahora usan el logo oficial.',
      })
      await refresh()
    } catch (err) {
      toast.error('No se pudieron vincular', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setLinking(false)
    }
  }

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand)
    setIsModalOpen(true)
  }

  const productCount = (brand: Brand) => brand.stats?.product_count ?? 0

  const handleConfirmDelete = async () => {
    if (!deleteTarget || productCount(deleteTarget) > 0) {
      setDeleteTarget(null)
      return
    }
    const res = await deleteBrand(deleteTarget.id)
    if (res.success) toast.success('Marca eliminada')
    else toast.error(res.error || 'No se pudo eliminar la marca')
    setDeleteTarget(null)
    void loadSuggestions()
  }

  const handleToggleActive = async (brand: Brand) => {
    const res = await updateBrand(brand.id, { is_active: !brand.is_active })
    if (res.success) toast.success(`Marca ${!brand.is_active ? 'activada' : 'desactivada'}`)
    else toast.error(res.error || 'No se pudo cambiar el estado')
  }

  const handleModalSave = async (data: Parameters<typeof createBrand>[0]) => {
    const res = editingBrand ? await updateBrand(editingBrand.id, data) : await createBrand(data)
    if (res.success) void loadSuggestions()
    return { success: res.success, error: res.error }
  }

  const openCatalog = () => setIsCatalogOpen(true)
  const openCreateOwn = (name = '') => {
    setEditingBrand(undefined)
    setCreateMode('own')
    setCreateName(name)
    setIsModalOpen(true)
  }

  const limit = filters.limit || 12
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))
  const currentPage = filters.page || 1
  const hasFilters = Boolean(searchTerm.trim()) || statusFilter !== 'all' || linkFilter !== 'all'
  const deleteBlocked = deleteTarget ? productCount(deleteTarget) : 0

  const chip = (active: boolean) => cn(
    'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
    active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'
  )

  return (
    <RouteGuard route="/dashboard/brands">
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Marcas</h1>
            <p className="text-muted-foreground">
              Las marcas de tus productos. Elegí las oficiales del catálogo para usar su logo y aparecer agrupado en el marketplace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SectionGuideButton guide={BRANDS_GUIDE} />
            <Button variant="outline" onClick={() => openCreateOwn()}>
              <Plus className="mr-2 h-4 w-4" />
              Crear marca propia
            </Button>
            <Button onClick={openCatalog}>
              <BadgeCheck className="mr-2 h-4 w-4" />
              Agregar marcas oficiales
            </Button>
          </div>
        </div>

        {/* Propias que ya existen en el catálogo: vincularlas les pone el logo oficial. */}
        {linkSuggestions.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">
                  {linkSuggestions.length === 1
                    ? '1 marca tuya existe en el catálogo oficial'
                    : `${linkSuggestions.length} marcas tuyas existen en el catálogo oficial`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {linkSuggestions.slice(0, 5).map((row) => row.official_name).join(', ')}
                  {linkSuggestions.length > 5 ? ` y ${linkSuggestions.length - 5} más` : ''}. Al vincularlas usan el logo oficial y se agrupan en el marketplace; sus productos no cambian.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => void handleLinkAll()} disabled={linking} className="shrink-0 gap-1.5">
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Vincular {linkSuggestions.length === 1 ? 'la marca' : `las ${linkSuggestions.length}`}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Buscar marcas…"
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Buscar marcas"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => void refresh()} aria-label="Actualizar" title="Actualizar">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            <span className="ml-auto text-sm text-muted-foreground">
              {totalCount} marca{totalCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar marcas">
            {([['all', 'Todas'], ['active', 'Activas'], ['inactive', 'Inactivas']] as const).map(([value, label]) => (
              <button key={value} type="button" className={chip(statusFilter === value)} aria-pressed={statusFilter === value} onClick={() => applyStatusFilter(value)}>
                {label}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
            {([['all', 'Oficiales y propias'], ['official', 'Oficiales'], ['own', 'Propias']] as const).map(([value, label]) => (
              <button key={value} type="button" className={chip(linkFilter === value)} aria-pressed={linkFilter === value} onClick={() => applyLinkFilter(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/15 px-4 py-3 text-destructive">
            <p className="font-medium">No se pudieron cargar las marcas</p>
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void fetchBrands()} className="mt-2 border-destructive/20 hover:bg-destructive/20">
              Reintentar
            </Button>
          </div>
        )}

        {loading && brands.length === 0 ? (
          <div className="flex justify-center py-8" role="status" aria-label="Cargando marcas">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : brands.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">{hasFilters ? 'Ninguna marca coincide' : 'Todavía no tenés marcas'}</h3>
              <p className="mb-4 max-w-md text-muted-foreground">
                {hasFilters
                  ? 'Probá con otro término o cambiá los filtros.'
                  : 'Buscá la marca en el catálogo oficial: así tus productos usan su logo. Si no está, la podés crear como propia.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={openCatalog}>
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  Agregar marcas oficiales
                </Button>
                <Button variant="outline" onClick={() => openCreateOwn()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear marca propia
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {brands.map((brand) => {
                const website = toSafeWebsiteHref(brand.website)
                const products = productCount(brand)
                return (
                  <Card
                    key={brand.id}
                    role="button"
                    tabIndex={0}
                    className={cn('cursor-pointer overflow-hidden rounded-2xl transition-all hover:border-primary/40 hover:shadow-md', !brand.is_active && 'opacity-70')}
                    onClick={() => setSelectedDetailBrand(brand)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedDetailBrand(brand)
                      }
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <BrandMark brand={brand} />
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base">{brand.name}</CardTitle>
                            <CardDescription className="text-xs">
                              {products === 1 ? '1 producto' : `${products} productos`}
                              {brand.country ? ` · ${brand.country}` : ''}
                            </CardDescription>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="-mr-2 -mt-2" aria-label={`Acciones de ${brand.name}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEdit(brand)}>
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleToggleActive(brand)}>
                              {brand.is_active
                                ? <><XCircle className="mr-2 h-4 w-4" /> Desactivar</>
                                : <><CheckCircle className="mr-2 h-4 w-4" /> Activar</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(brand)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="min-h-10 line-clamp-2 text-sm text-muted-foreground">
                        {brand.description || 'Sin descripción'}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Badge variant={brand.is_active ? 'default' : 'secondary'}>
                          {brand.is_active ? 'Activa' : 'Inactiva'}
                        </Badge>
                        {brand.global_brand_id ? (
                          <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-primary">
                            <BadgeCheck className="h-3 w-3" aria-hidden="true" /> Oficial
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Propia</Badge>
                        )}
                        {website && (
                          <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto max-w-[150px] truncate text-xs text-primary hover:underline"
                          >
                            {website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void fetchBrands({ page: currentPage - 1 })} disabled={currentPage <= 1 || loading}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => void fetchBrands({ page: currentPage + 1 })} disabled={currentPage >= totalPages || loading}>
                  Siguiente <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        <BrandModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          brand={editingBrand}
          initialMode={createMode}
          initialName={createName}
          onSave={handleModalSave}
        />

        <BrandCatalogDialog
          open={isCatalogOpen}
          onOpenChange={setIsCatalogOpen}
          onAdded={() => void refresh()}
          onCreateOwn={(name) => openCreateOwn(name)}
        />

        <BrandDetailModal
          isOpen={selectedDetailBrand !== undefined}
          onClose={() => setSelectedDetailBrand(undefined)}
          brand={selectedDetailBrand}
          onEdit={handleEdit}
        />

        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteBlocked > 0 ? 'No se puede eliminar' : `¿Eliminar «${deleteTarget?.name ?? ''}»?`}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteBlocked > 0
                  ? `Esta marca tiene ${deleteBlocked} producto${deleteBlocked === 1 ? '' : 's'}. Cambiales la marca o desactivala en lugar de eliminarla.`
                  : 'La marca se eliminará permanentemente. Esta acción no se puede deshacer.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{deleteBlocked > 0 ? 'Entendido' : 'Cancelar'}</AlertDialogCancel>
              {deleteBlocked === 0 && (
                <AlertDialogAction onClick={() => void handleConfirmDelete()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Eliminar
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RouteGuard>
  )
}
