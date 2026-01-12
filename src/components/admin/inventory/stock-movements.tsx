'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ArrowUpDown, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  RefreshCw,
  Filter,
  Download,
  Eye,
  Calendar,
  Clock,
  User,
  FileText,
  BarChart3,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Interfaces
interface StockMovement {
  id: string
  product_id: string
  product: { name: string; sku: string }
  type: 'entrada' | 'salida' | 'ajuste' | 'transferencia' | 'devolucion'
  quantity: number
  previous_stock: number
  new_stock: number
  reason: string
  reference?: string
  user_id: string
  created_at: string
  notes?: string
}

interface MovementSummary {
  totalMovements: number
  totalEntradas: number
  totalSalidas: number
  totalAjustes: number
}

const StockMovements: React.FC = () => {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  
  // Paginación
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  
  const [summary, setSummary] = useState<MovementSummary | null>(null)

  const supabase = createClient()

  const fetchMovements = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('product_movements')
        .select(`
          *,
          product:products(name, sku)
        `, { count: 'exact' })

      // Aplicar filtros
      if (filterType !== 'all') {
        query = query.eq('type', filterType)
      }

      if (filterDateFrom) {
        query = query.gte('created_at', `${filterDateFrom}T00:00:00`)
      }

      if (filterDateTo) {
        query = query.lte('created_at', `${filterDateTo}T23:59:59`)
      }

      // Si hay búsqueda por texto, necesitamos buscar en la relación o campos locales
      // Supabase no soporta filtrado profundo en relaciones fácilmente con OR
      // Por simplicidad, filtramos por razón o referencia aquí, y si es posible por producto
      if (searchTerm) {
        query = query.or(`reason.ilike.%${searchTerm}%,reference.ilike.%${searchTerm}%`)
      }

      // Paginación
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      setMovements(data as any) // Cast to any to avoid strict typing issues with joins for now
      setTotalCount(count || 0)

      // Calcular resumen (esto debería ser un count en el servidor idealmente, pero haremos un simple conteo de la página actual o query separada)
      // Para un resumen real de TODO el periodo, necesitaríamos queries agregadas.
      // Haremos queries separadas para el resumen
      fetchSummary()

    } catch (error) {
      console.error('Error fetching movements:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, page, pageSize, filterType, filterDateFrom, filterDateTo, searchTerm])

  const fetchSummary = async () => {
    // Esta función podría ser costosa si hay muchos datos. 
    // Idealmente usar un RPC o vistas materializadas.
    // Por ahora haremos queries count simples.
    try {
      const { count: total } = await supabase.from('product_movements').select('*', { count: 'exact', head: true })
      const { count: entradas } = await supabase.from('product_movements').select('*', { count: 'exact', head: true }).eq('type', 'entrada')
      const { count: salidas } = await supabase.from('product_movements').select('*', { count: 'exact', head: true }).eq('type', 'salida')
      const { count: ajustes } = await supabase.from('product_movements').select('*', { count: 'exact', head: true }).eq('type', 'ajuste')

      setSummary({
        totalMovements: total || 0,
        totalEntradas: entradas || 0,
        totalSalidas: salidas || 0,
        totalAjustes: ajustes || 0
      })
    } catch (error) {
      console.error('Error fetching summary:', error)
    }
  }

  useEffect(() => {
    fetchMovements()
  }, [fetchMovements])

  // Funciones utilitarias
  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'entrada': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
      case 'salida': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
      case 'ajuste': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
      case 'transferencia': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800'
      case 'devolucion': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800'
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
    }
  }

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'entrada': return <TrendingUp className="h-4 w-4" />
      case 'salida': return <TrendingDown className="h-4 w-4" />
      case 'ajuste': return <ArrowUpDown className="h-4 w-4" />
      case 'transferencia': return <RefreshCw className="h-4 w-4" />
      case 'devolucion': return <Package className="h-4 w-4" />
      default: return <Package className="h-4 w-4" />
    }
  }

  const exportMovements = () => {
    const csvContent = [
      ['Fecha', 'Producto', 'SKU', 'Tipo', 'Cantidad', 'Stock Anterior', 'Stock Nuevo', 'Motivo', 'Referencia'],
      ...movements.map(m => [
        new Date(m.created_at).toLocaleString(),
        m.product?.name || 'Producto eliminado',
        m.product?.sku || 'N/A',
        m.type,
        m.quantity.toString(),
        m.previous_stock.toString(),
        m.new_stock.toString(),
        m.reason,
        m.reference || ''
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `movimientos_stock_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Movimientos de Stock</h2>
          <p className="text-gray-600 dark:text-gray-400">Historial detallado y análisis de movimientos de inventario</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportMovements} className="dark:bg-gray-800 dark:text-white dark:border-gray-700">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Resumen */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Movimientos</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.totalMovements}</p>
                </div>
                <ArrowUpDown className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Entradas</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.totalEntradas}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Salidas</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.totalSalidas}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ajustes</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{summary.totalAjustes}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center dark:text-white">
            <Filter className="h-5 w-5 mr-2" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Razón, referencia..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Movimiento</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="salida">Salidas</SelectItem>
                  <SelectItem value="ajuste">Ajustes</SelectItem>
                  <SelectItem value="transferencia">Transferencias</SelectItem>
                  <SelectItem value="devolucion">Devoluciones</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha Desde</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Movimientos */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="dark:text-white">Historial de Movimientos</CardTitle>
              <CardDescription className="dark:text-gray-400">
                Mostrando {movements.length} de {totalCount} movimientos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Cargando movimientos...</div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No se encontraron movimientos.</div>
          ) : (
            <div className="space-y-4">
              {movements.map(movement => (
                <div key={movement.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg ${getMovementTypeColor(movement.type)}`}>
                        {getMovementIcon(movement.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium dark:text-white">{movement.product?.name || 'Producto Desconocido'}</h4>
                          <Badge variant="outline" className="dark:text-gray-300 dark:border-gray-600">{movement.product?.sku || 'N/A'}</Badge>
                          <Badge className={getMovementTypeColor(movement.type)}>
                            {movement.type.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{movement.reason}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-500">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {format(new Date(movement.created_at), 'dd/MM/yyyy', { locale: es })}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {format(new Date(movement.created_at), 'HH:mm', { locale: es })}
                          </span>
                          {movement.reference && (
                            <span className="flex items-center">
                              <FileText className="h-3 w-3 mr-1" />
                              {movement.reference}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2 mb-1 justify-end">
                        <span className={`text-lg font-semibold ${
                          movement.type === 'entrada' || movement.type === 'devolucion' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {(movement.type === 'entrada' || movement.type === 'devolucion') ? '+' : '-'}{Math.abs(movement.quantity)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMovement(movement)
                            setIsDetailDialogOpen(true)
                          }}
                          className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {movement.previous_stock} → {movement.new_stock}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Página {page} de {totalPages}
              </p>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="dark:bg-gray-700 dark:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  className="dark:bg-gray-700 dark:text-white"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Detalle del Movimiento */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl dark:bg-gray-800 dark:text-white dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Detalle del Movimiento
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Información completa del movimiento de stock
            </DialogDescription>
          </DialogHeader>

          {selectedMovement && (
            <div className="space-y-6">
              {/* Información del Producto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Producto</Label>
                  <p className="font-semibold dark:text-white">{selectedMovement.product?.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">SKU</Label>
                  <p className="font-semibold dark:text-white">{selectedMovement.product?.sku}</p>
                </div>
              </div>

              {/* Información del Movimiento */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Tipo</Label>
                  <Badge className={getMovementTypeColor(selectedMovement.type)}>
                    {selectedMovement.type.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Cantidad</Label>
                  <p className="font-semibold text-lg dark:text-white">
                    {(selectedMovement.type === 'entrada' || selectedMovement.type === 'devolucion') ? '+' : '-'}
                    {Math.abs(selectedMovement.quantity)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Fecha</Label>
                  <p className="font-semibold dark:text-white">
                    {format(new Date(selectedMovement.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
              </div>

              {/* Stock */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Stock Anterior</Label>
                  <p className="font-semibold dark:text-white">{selectedMovement.previous_stock}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Cambio</Label>
                  <p className={`font-semibold ${
                    selectedMovement.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {selectedMovement.quantity > 0 ? '+' : ''}{selectedMovement.quantity}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Stock Final</Label>
                  <p className="font-semibold dark:text-white">{selectedMovement.new_stock}</p>
                </div>
              </div>

              {/* Información Adicional */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Motivo</Label>
                  <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg dark:text-white">{selectedMovement.reason}</p>
                </div>

                {selectedMovement.notes && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Notas</Label>
                    <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg dark:text-white">{selectedMovement.notes}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {selectedMovement.reference && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Referencia</Label>
                      <p className="font-semibold dark:text-white">{selectedMovement.reference}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)} className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
              Cerrar
            </Button>
            {selectedMovement?.reference && (
              <Button variant="outline" className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Documento
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default StockMovements