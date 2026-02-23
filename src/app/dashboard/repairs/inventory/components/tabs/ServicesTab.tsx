
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
  Lock
} from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { ServiceDialog } from '../ServiceDialog'
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function ServicesTab() {
  const { services, loading, deleteItem } = useInventory()
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<any>(null)
  
  // State for view mode: 'all', 'retail', 'wholesale'
  const [viewMode, setViewMode] = useState<'all' | 'retail' | 'wholesale'>('all')

  const filteredServices = useMemo(() => {
    return services.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [services, searchTerm])

  const handleEdit = (service: any) => {
    setEditingService(service)
    setIsDialogOpen(true)
  }

  const handleNew = () => {
    setEditingService(null)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este servicio?')) {
      await deleteItem(id)
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
      <Card>
        <CardHeader>
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
              <CardTitle>Catálogo de Servicios</CardTitle>
              <CardDescription>Gestión de precios para mano de obra y reparaciones</CardDescription>
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
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Servicio</TableHead>
                  <TableHead className="w-[20%] hidden md:table-cell">Descripción</TableHead>
                  
                  {/* Conditionally show columns based on viewMode */}
                  {(viewMode === 'all' || viewMode === 'retail') && (
                    <TableHead>Precio Cliente</TableHead>
                  )}
                  
                  {(viewMode === 'all' || viewMode === 'wholesale') && (
                    <TableHead>Precio Mayorista</TableHead>
                  )}
                  
                  {viewMode === 'all' && (
                    <>
                      <TableHead>Costo Base</TableHead>
                      <TableHead>Visibilidad</TableHead>
                      <TableHead className="text-right">Margen</TableHead>
                    </>
                  )}
                  
                  <TableHead className="text-right w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-12 w-12 opacity-50" />
                        <p>No hay servicios registrados.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredServices.map((service) => {
                    const margin = (service.sale_price || 0) - (service.purchase_price || 0)
                    const marginPercent = service.sale_price ? (margin / service.sale_price) * 100 : 0
                    
                    return (
                      <TableRow key={service.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{service.name}</span>
                            <span className="md:hidden text-xs text-muted-foreground truncate max-w-[200px]">
                              {service.description}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                          {service.description || "-"}
                        </TableCell>
                        
                        {/* Retail Price Column */}
                        {(viewMode === 'all' || viewMode === 'retail') && (
                          <TableCell>
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              ${service.sale_price?.toFixed(2)}
                            </span>
                          </TableCell>
                        )}
                        
                        {/* Wholesale Price Column */}
                        {(viewMode === 'all' || viewMode === 'wholesale') && (
                          <TableCell>
                            <span className="font-bold text-purple-600 dark:text-purple-400">
                              ${service.wholesale_price?.toFixed(2) || '-'}
                            </span>
                          </TableCell>
                        )}
                        
                        {/* Cost, Visibility & Margin Columns (Only in 'all' mode) */}
                        {viewMode === 'all' && (
                          <>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                ${service.purchase_price?.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {getVisibilityBadge(service.visibility || 'public')}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge 
                                className={`font-semibold ${
                                  marginPercent >= 50 ? 'bg-green-500 hover:bg-green-600 text-white' :
                                  marginPercent >= 30 ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                                  marginPercent >= 15 ? 'bg-amber-500 hover:bg-amber-600 text-white' :
                                  'bg-red-500 hover:bg-red-600 text-white'
                                }`}
                              >
                                {marginPercent.toFixed(0)}%
                              </Badge>
                            </TableCell>
                          </>
                        )}
                        
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleEdit(service)}
                              className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20 h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 h-8 w-8" 
                              onClick={() => handleDelete(service.id)}
                            >
                              <Trash2 className="h-4 w-4" />
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
    </>
  )
}
