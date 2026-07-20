'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Search, RefreshCw, Building2, MoreVertical, Edit, Trash2, CheckCircle, XCircle, ChevronLeft, ChevronRight, Info } from 'lucide-react'
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
import { BrandModal } from '@/components/dashboard/brands/BrandModal'
import { BrandDetailModal } from '@/components/dashboard/brands/BrandDetailModal'
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
    deleteBrand
  } = useBrands()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | undefined>(undefined)
  const [selectedDetailBrand, setSelectedDetailBrand] = useState<Brand | undefined>(undefined)
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null })
  
  // Local state for search input to allow debouncing
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 500)

  // Sync debounced search with hook filters
  useEffect(() => {
    // Only fetch if the search term actually changed from what's in filters
    // or if it's the first run (filters.search is empty)
    if (debouncedSearch !== filters.search) {
        fetchBrands({ search: debouncedSearch, page: 1 })
    }
  }, [debouncedSearch, fetchBrands, filters.search])

  // Initialize local search term from filters on mount (if navigating back)
  useEffect(() => {
    if (filters.search) setSearchTerm(filters.search)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand)
    setIsModalOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setDeleteDialog({ isOpen: true, id })
  }

  const handleConfirmDelete = async () => {
    if (deleteDialog.id) {
      const res = await deleteBrand(deleteDialog.id)
      if (res.success) {
        toast.success('Marca eliminada exitosamente')
      } else {
        toast.error(res.error || 'Error al eliminar marca')
      }
    }
    setDeleteDialog({ isOpen: false, id: null })
  }

  const handleToggleActive = async (brand: Brand) => {
    const res = await updateBrand(brand.id, { is_active: !brand.is_active })
    if (res.success) {
      toast.success(`Marca ${!brand.is_active ? 'activada' : 'desactivada'} exitosamente`)
    } else {
      toast.error(res.error || 'Error al actualizar estado')
    }
  }

  const handleModalSave = async (data: any) => {
    if (editingBrand) {
      const res = await updateBrand(editingBrand.id, data)
      return { success: res.success, error: res.error }
    } else {
      const res = await createBrand(data)
      return { success: res.success, error: res.error }
    }
  }

  const handlePageChange = (newPage: number) => {
    fetchBrands({ page: newPage })
  }

  const totalPages = Math.ceil(totalCount / (filters.limit || 12))
  const currentPage = filters.page || 1
  const toSafeWebsiteHref = (raw?: string | null) => {
    if (!raw) return null
    const value = raw.trim()
    if (!value) return null
    return /^https?:\/\//i.test(value) ? value : null
  }

  return (
    <RouteGuard route="/dashboard/brands">
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestión de Marcas</h1>
            <p className="text-muted-foreground">
              Administra las marcas disponibles para tus productos ({totalCount} total)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => { setEditingBrand(undefined); setIsModalOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Marca
            </Button>
          </div>
        </div>

        {/* Guía de funcionamiento de marcas */}
        <Card className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-100/50 dark:border-blue-950/20 backdrop-blur-md">
          <details className="group">
            <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-5 pb-3">
              <div className="text-md font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Info className="h-4.5 w-4.5" /> ¿Cómo funciona la Gestión de Marcas?
              </div>
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 select-none">
                <span className="group-open:hidden flex items-center gap-1">Mostrar guía ↓</span>
                <span className="hidden group-open:flex items-center gap-1">Ocultar guía ↑</span>
              </div>
            </summary>
            <CardContent className="pt-0 pb-5 text-xs">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                  <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                    <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">1</Badge>
                    Marcas y Fabricantes
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Registra las marcas de repuestos o dispositivos que comercializa tu negocio. Esto te permite clasificar el inventario de manera más clara para las búsquedas.
                  </p>
                </div>
                <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">2</Badge>
                    Filtros y Búsqueda
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Usa la barra de búsqueda para localizar marcas activas o inactivas. Al asociar una marca a un producto, los clientes podrán filtrar por este atributo en el POS o web.
                  </p>
                </div>
                <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">3</Badge>
                    Habilitar o Deshabilitar
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Puedes desactivar de forma temporal marcas obsoletas o sin stock para quitarlas del catálogo activo, sin alterar el historial de facturación previo.
                  </p>
                </div>
              </div>
            </CardContent>
          </details>
        </Card>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar marcas..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => fetchBrands()}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {error && (
          <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md mb-6">
            <p className="font-medium">Error al cargar marcas</p>
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchBrands()} className="mt-2 border-destructive/20 hover:bg-destructive/20">
              Reintentar
            </Button>
          </div>
        )}

        {loading && brands.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : brands.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No hay marcas encontradas</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza creando tu primera marca'}
              </p>
              <Button onClick={() => { setEditingBrand(undefined); setIsModalOpen(true) }}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Marca
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {brands.map((brand) => (
                <Card 
                  key={brand.id} 
                  className="overflow-hidden transition-all hover:shadow-md cursor-pointer hover:border-slate-350 dark:hover:border-slate-700 bg-white/70 backdrop-blur-md dark:bg-slate-950/65 rounded-[24px] border border-slate-200/50 dark:border-slate-800/50"
                  onClick={() => setSelectedDetailBrand(brand)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{brand.name}</CardTitle>
                          {brand.country && (
                            <CardDescription className="text-xs">
                              {brand.country}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="-mr-2 -mt-2">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEdit(brand)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(brand)}>
                            {brand.is_active ? (
                              <>
                                <XCircle className="mr-2 h-4 w-4" /> Desactivar
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" /> Activar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteClick(brand.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground line-clamp-2 min-h-10">
                      {brand.description || 'Sin descripción'}
                    </div>
                    <div className="mt-4 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <Badge variant={brand.is_active ? 'default' : 'secondary'}>
                        {brand.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                      {toSafeWebsiteHref(brand.website) && (
                        <a 
                          href={toSafeWebsiteHref(brand.website)!}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate max-w-[150px]"
                        >
                          {brand.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || loading}
                >
                  Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}

        <BrandModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          brand={editingBrand}
          onSave={handleModalSave}
        />

        <BrandDetailModal
          isOpen={selectedDetailBrand !== undefined}
          onClose={() => setSelectedDetailBrand(undefined)}
          brand={selectedDetailBrand}
          onEdit={handleEdit}
        />

        <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => !open && setDeleteDialog(prev => ({ ...prev, isOpen: false }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La marca se eliminará permanentemente.
                Si tiene productos asociados, no podrá ser eliminada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RouteGuard>
  )
}

