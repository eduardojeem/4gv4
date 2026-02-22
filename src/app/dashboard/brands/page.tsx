'use client'

import React, { useState, useMemo } from 'react'
import { Plus, Search, RefreshCw, Building2, MoreVertical, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react'
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
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs'
import { AdminGuard } from '@/components/admin/AdminGuard'

export default function BrandsPage() {
  const {
    brands,
    loading,
    filters,
    setFilters,
    fetchBrands,
    createBrand,
    updateBrand,
    deleteBrand
  } = useBrands()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | undefined>(undefined)
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null })

  const filteredBrands = useMemo(() => {
    return brands
  }, [brands])

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

  return (
    <AdminGuard permission="products.manage">
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestión de Marcas</h1>
            <p className="text-muted-foreground">
              Administra las marcas disponibles para tus productos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => { setEditingBrand(undefined); setIsModalOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Marca
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar marcas..."
              className="pl-8"
              value={filters.search || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => fetchBrands()}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading && brands.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : filteredBrands.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No hay marcas encontradas</h3>
              <p className="text-muted-foreground mb-4">
                {filters.search ? 'Intenta con otros términos de búsqueda' : 'Comienza creando tu primera marca'}
              </p>
              <Button onClick={() => { setEditingBrand(undefined); setIsModalOpen(true) }}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Marca
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBrands.map((brand) => (
              <Card key={brand.id} className="overflow-hidden transition-all hover:shadow-md">
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
                      <DropdownMenuTrigger asChild>
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
                  <div className="mt-4 flex items-center justify-between">
                    <Badge variant={brand.is_active ? 'default' : 'secondary'}>
                      {brand.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    {brand.website && (
                      <a 
                        href={brand.website} 
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
        )}

        <BrandModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          brand={editingBrand}
          onSave={handleModalSave}
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
    </AdminGuard>
  )
}
