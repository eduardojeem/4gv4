
"use client"

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  RefreshCw, 
  Package, 
  Users, 
  User,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Wrench
} from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { ServiceDialog } from '../ServiceDialog'
import { ServiceDetailDialog } from '../ServiceDetailDialog'
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
import type { Product } from '@/types/product-unified'
import { formatPrice, cn } from '@/lib/utils'

export function ServicesTab() {
  const { services, loading, deleteItem, updateService } = useInventory()
  const [searchTerm, setSearchTerm] = useState("")
  const [togglingId, setTogglingId] = useState<string | null>(null)
  
  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  
  // Selected Data States
  const [editingService, setEditingService] = useState<Product | null>(null)
  const [viewingService, setViewingService] = useState<Product | null>(null)
  
  // State for view mode: 'all', 'retail', 'wholesale'
  const [viewMode, setViewMode] = useState<'all' | 'retail' | 'wholesale'>('all')
  const [serviceToDelete, setServiceToDelete] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))

      // El modo es un lente de precios, no de visibilidad web (eso lo maneja
      // el toggle 🌐 por fila). Mayorista = servicios con precio mayorista cargado.
      let matchesMode = true
      if (viewMode === 'wholesale') matchesMode = Number(s.wholesale_price ?? 0) > 0

      return matchesSearch && matchesMode
    })
  }, [services, searchTerm, viewMode])

  const handleEdit = (service: Product) => {
    setEditingService(service)
    setIsDialogOpen(true)
  }

  const handleView = (service: Product) => {
    setViewingService(service)
    setIsDetailOpen(true)
  }

  const handleNew = () => {
    setEditingService(null)
    setIsDialogOpen(true)
  }

  const handleDelete = (service: Product) => {
    setServiceToDelete(service)
  }

  // Alterna la visibilidad web del servicio (público ↔ oculto) en 1 clic.
  const handleToggleWeb = async (service: Product) => {
    const isVisible = (service.visibility || 'public') === 'public'
    setTogglingId(service.id)
    try {
      await updateService(service.id, { visibility: isVisible ? 'hidden' : 'public' })
    } finally {
      setTogglingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!serviceToDelete) return
    setIsDeleting(true)
    try {
      await deleteItem(serviceToDelete.id)
    } finally {
      setIsDeleting(false)
      setServiceToDelete(null)
    }
  }

  const getVisibilityBadge = (visibility: string) => {
    switch (visibility) {
      case 'wholesale':
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1">
            <Lock className="h-3 w-3" /> Mayorista
          </Badge>
        )
      case 'hidden':
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 gap-1">
            <EyeOff className="h-3 w-3" /> Oculto
          </Badge>
        )
      case 'public':
      default:
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
            <Globe className="h-3 w-3" /> Público
          </Badge>
        )
    }
  }

  return (
    <>
      <Card className="bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-teal-500/5 pointer-events-none" />
        <CardHeader className="relative z-10 border-b border-border/30 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                <span className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <Wrench className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </span>
                Catálogo de Servicios
              </CardTitle>
              <CardDescription>
                Gestiona los servicios de reparación y mano de obra
              </CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
              {/* View Mode Toggle */}
              <div className="bg-muted p-1 rounded-lg">
                <ToggleGroup 
                  type="single" 
                  value={viewMode} 
                  onValueChange={(val) => val && setViewMode(val as any)}
                  className="justify-start"
                >
                  <ToggleGroupItem value="all" aria-label="Ver todo" className="gap-2 px-3">
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Todo</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="retail" aria-label="Cliente Final" className="gap-2 px-3">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">Cliente</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="wholesale" aria-label="Mayorista" className="gap-2 px-3">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Mayorista</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar servicio..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button onClick={handleNew} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md shrink-0">
                  <Plus className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Nuevo</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
                <TableRow>
                  <TableHead className="w-[30%] font-bold text-slate-900 dark:text-slate-100 text-xs py-3">Servicio</TableHead>
                  <TableHead className="w-[20%] hidden md:table-cell font-bold text-slate-900 dark:text-slate-100 text-xs py-3">Descripción</TableHead>

                  {/* Conditionally show columns based on viewMode */}
                  {(viewMode === 'all' || viewMode === 'retail') && (
                    <TableHead className="font-bold text-slate-900 dark:text-slate-100 text-xs py-3">Precio Cliente</TableHead>
                  )}

                  {(viewMode === 'all' || viewMode === 'wholesale') && (
                    <TableHead className="font-bold text-slate-900 dark:text-slate-100 text-xs py-3">Precio Mayorista</TableHead>
                  )}

                  {viewMode === 'all' && (
                    <>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 text-xs py-3">Costo Base</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 text-xs py-3">Visibilidad Web</TableHead>
                      <TableHead className="text-right font-bold text-slate-900 dark:text-slate-100 text-xs py-3">Margen %</TableHead>
                    </>
                  )}

                  <TableHead className="text-right w-[140px] font-bold text-slate-900 dark:text-slate-100 text-xs py-3">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={viewMode === 'all' ? 7 : 4} className="text-center py-12">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-emerald-600 dark:text-emerald-400" />
                    </TableCell>
                  </TableRow>
                ) : filteredServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={viewMode === 'all' ? 7 : 4} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-12 w-12 opacity-40 text-emerald-500" />
                        <p className="font-medium text-sm">No hay servicios registrados en este filtro.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredServices.map((service) => {
                    const margin = (service.sale_price || 0) - (service.purchase_price || 0)
                    const marginPercent = service.sale_price ? (margin / service.sale_price) * 100 : 0

                    return (
                      <TableRow key={service.id} className="hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors border-b border-slate-100 dark:border-slate-800/80">
                        <TableCell className="font-medium py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/50 dark:border-emerald-800/50">
                              <Wrench className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{service.name}</span>
                              <span className="md:hidden text-xs text-muted-foreground truncate max-w-[180px]">
                                {service.description}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell py-3.5">
                          {service.description || "-"}
                        </TableCell>

                        {/* Retail Price Column */}
                        {(viewMode === 'all' || viewMode === 'retail') && (
                          <TableCell className="py-3.5">
                            <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                              {formatPrice(service.sale_price || 0)}
                            </span>
                          </TableCell>
                        )}

                        {/* Wholesale Price Column */}
                        {(viewMode === 'all' || viewMode === 'wholesale') && (
                          <TableCell className="py-3.5">
                            <span className="font-bold text-sm text-purple-600 dark:text-purple-400">
                              {service.wholesale_price ? formatPrice(service.wholesale_price) : '-'}
                            </span>
                          </TableCell>
                        )}

                        {/* Cost, Visibility & Margin Columns (Only in 'all' mode) */}
                        {viewMode === 'all' && (
                          <>
                            <TableCell className="py-3.5">
                              <span className="text-xs text-muted-foreground font-mono">
                                {formatPrice(service.purchase_price || 0)}
                              </span>
                            </TableCell>
                            <TableCell className="py-3.5">
                              {getVisibilityBadge(service.visibility || 'public')}
                            </TableCell>
                            <TableCell className="text-right py-3.5">
                              <Badge
                                className={cn(
                                  "font-semibold text-xs px-2 py-0.5 rounded-full shadow-sm",
                                  marginPercent >= 50 ? 'bg-emerald-500 hover:bg-emerald-600 text-white' :
                                  marginPercent >= 30 ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                                  marginPercent >= 15 ? 'bg-amber-500 hover:bg-amber-600 text-white' :
                                  'bg-red-500 hover:bg-red-600 text-white'
                                )}
                              >
                                {marginPercent.toFixed(0)}%
                              </Badge>
                            </TableCell>
                          </>
                        )}

                        <TableCell className="text-right py-3.5">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleWeb(service)}
                              disabled={togglingId === service.id}
                              className={cn(
                                "h-8 w-8 rounded-lg transition-colors",
                                (service.visibility || 'public') === 'public'
                                  ? 'hover:bg-emerald-50 text-emerald-600 dark:hover:bg-emerald-950/40'
                                  : 'hover:bg-slate-100 text-slate-400 dark:hover:bg-slate-800'
                              )}
                              title={
                                (service.visibility || 'public') === 'public'
                                  ? 'Visible en la web — clic para ocultar'
                                  : 'Oculto en la web — clic para mostrar'
                              }
                            >
                              {togglingId === service.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (service.visibility || 'public') === 'public' ? (
                                <Globe className="h-3.5 w-3.5" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(service)}
                              className="hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 h-8 w-8 rounded-lg"
                              title="Ver detalles"
                            >
                              <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(service)}
                              className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 h-8 w-8 rounded-lg"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 h-8 w-8 rounded-lg"
                              onClick={() => handleDelete(service)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ServiceDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        service={editingService}
      />
      
      <ServiceDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        service={viewingService}
        onEdit={handleEdit}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!serviceToDelete} onOpenChange={(open) => !open && setServiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              ¿Eliminar servicio?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar <strong className="text-foreground">"{serviceToDelete?.name}"</strong>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Eliminando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
