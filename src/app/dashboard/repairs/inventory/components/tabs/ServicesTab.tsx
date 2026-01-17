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
import { Search, Plus, Pencil, Trash2, RefreshCw, Package } from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { ServiceDialog } from '../ServiceDialog'

export function ServicesTab() {
  const { services, loading, deleteItem } = useInventory()
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<any>(null)

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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <CardTitle>Catálogo de Servicios</CardTitle>
              <CardDescription>Precios de mano de obra y reparaciones estándar</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar servicio..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button onClick={handleNew} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md">
                <Plus className="mr-2 h-4 w-4" /> Nuevo Servicio
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Costo Base</TableHead>
                  <TableHead>Precio Cliente</TableHead>
                  <TableHead>Precio Mayorista</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{service.description || "-"}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            ${service.purchase_price?.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            ${service.sale_price?.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-purple-600 dark:text-purple-400 font-semibold">
                            ${service.wholesale_price?.toFixed(2) || '-'}
                          </span>
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
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleEdit(service)}
                              className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20" 
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
