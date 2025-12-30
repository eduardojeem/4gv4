'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { 
  ArrowUpDown, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Plus, 
  Minus, 
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
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'

// Interfaces
interface StockMovement {
  id: string
  productId: string
  productName: string
  productSku: string
  type: 'entrada' | 'salida' | 'ajuste' | 'transferencia' | 'devolucion'
  quantity: number
  previousStock: number
  newStock: number
  reason: string
  reference?: string
  userId: string
  userName: string
  timestamp: Date
  cost?: number
  supplier?: string
  location?: string
  notes?: string
  approved?: boolean
  approvedBy?: string
  approvedAt?: Date
}

interface MovementSummary {
  totalMovements: number
  totalEntradas: number
  totalSalidas: number
  totalAjustes: number
  valueImpact: number
  mostActiveProduct: string
  averageMovementValue: number
}

const StockMovements: React.FC = () => {
  // Estados
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [filteredMovements, setFilteredMovements] = useState<StockMovement[]>([])
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterUser, setFilterUser] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [summary, setSummary] = useState<MovementSummary | null>(null)

  // Datos mock
  const mockMovements: StockMovement[] = [
    {
      id: '1',
      productId: '1',
      productName: 'iPhone 15 Pro',
      productSku: 'IPH15P-128',
      type: 'entrada',
      quantity: 50,
      previousStock: 5,
      newStock: 55,
      reason: 'Reposición de inventario mensual',
      reference: 'PO-2024-001',
      userId: 'user1',
      userName: 'Juan Pérez',
      timestamp: new Date('2024-01-15T10:30:00'),
      cost: 800,
      supplier: 'Apple Inc.',
      location: 'Almacén Principal',
      notes: 'Productos recibidos en perfectas condiciones',
      approved: true,
      approvedBy: 'Admin',
      approvedAt: new Date('2024-01-15T10:35:00')
    },
    {
      id: '2',
      productId: '1',
      productName: 'iPhone 15 Pro',
      productSku: 'IPH15P-128',
      type: 'salida',
      quantity: 3,
      previousStock: 55,
      newStock: 52,
      reason: 'Venta al cliente - Factura #VT-001',
      reference: 'VT-2024-001',
      userId: 'user2',
      userName: 'María García',
      timestamp: new Date('2024-01-16T14:15:00'),
      location: 'Tienda Principal',
      approved: true,
      approvedBy: 'Supervisor',
      approvedAt: new Date('2024-01-16T14:20:00')
    },
    {
      id: '3',
      productId: '2',
      productName: 'Samsung Galaxy S24',
      productSku: 'SGS24-256',
      type: 'ajuste',
      quantity: -2,
      previousStock: 10,
      newStock: 8,
      reason: 'Ajuste por inventario físico - Productos dañados',
      reference: 'AJ-2024-001',
      userId: 'user3',
      userName: 'Carlos López',
      timestamp: new Date('2024-01-17T09:00:00'),
      location: 'Almacén Principal',
      notes: 'Productos con daños en pantalla detectados durante inventario',
      approved: true,
      approvedBy: 'Admin',
      approvedAt: new Date('2024-01-17T09:15:00')
    },
    {
      id: '4',
      productId: '3',
      productName: 'MacBook Air M3',
      productSku: 'MBA-M3-512',
      type: 'transferencia',
      quantity: 5,
      previousStock: 15,
      newStock: 10,
      reason: 'Transferencia a sucursal norte',
      reference: 'TR-2024-001',
      userId: 'user1',
      userName: 'Juan Pérez',
      timestamp: new Date('2024-01-18T11:30:00'),
      location: 'Sucursal Norte',
      notes: 'Transferencia autorizada por gerencia regional',
      approved: true,
      approvedBy: 'Gerente Regional',
      approvedAt: new Date('2024-01-18T11:45:00')
    },
    {
      id: '5',
      productId: '1',
      productName: 'iPhone 15 Pro',
      productSku: 'IPH15P-128',
      type: 'devolucion',
      quantity: 1,
      previousStock: 52,
      newStock: 53,
      reason: 'Devolución de cliente - Producto defectuoso',
      reference: 'DV-2024-001',
      userId: 'user2',
      userName: 'María García',
      timestamp: new Date('2024-01-19T16:20:00'),
      location: 'Tienda Principal',
      notes: 'Cliente reportó falla en cámara, producto enviado a garantía',
      approved: false
    }
  ]

  // Efectos
  useEffect(() => {
    setMovements(mockMovements)
    calculateSummary(mockMovements)
  }, [])

  useEffect(() => {
    applyFilters()
  }, [movements, searchTerm, filterType, filterDateFrom, filterDateTo, filterUser])

  // Funciones utilitarias
  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'entrada': return 'bg-green-100 text-green-800 border-green-200'
      case 'salida': return 'bg-red-100 text-red-800 border-red-200'
      case 'ajuste': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'transferencia': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'devolucion': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
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

  const getApprovalStatus = (movement: StockMovement) => {
    if (movement.approved === true) {
      return { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600', text: 'Aprobado' }
    } else if (movement.approved === false) {
      return { icon: <XCircle className="h-4 w-4" />, color: 'text-red-600', text: 'Pendiente' }
    }
    return { icon: <AlertCircle className="h-4 w-4" />, color: 'text-yellow-600', text: 'En Revisión' }
  }

  const calculateSummary = (movementsList: StockMovement[]) => {
    const totalMovements = movementsList.length
    const totalEntradas = movementsList.filter(m => m.type === 'entrada').length
    const totalSalidas = movementsList.filter(m => m.type === 'salida').length
    const totalAjustes = movementsList.filter(m => m.type === 'ajuste').length
    
    const valueImpact = movementsList.reduce((sum, m) => {
      if (m.cost) {
        return sum + (m.quantity * m.cost)
      }
      return sum
    }, 0)

    // Producto más activo
    const productCounts = movementsList.reduce((acc, m) => {
      acc[m.productName] = (acc[m.productName] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const mostActiveProduct = Object.entries(productCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'

    const averageMovementValue = totalMovements > 0 ? valueImpact / totalMovements : 0

    setSummary({
      totalMovements,
      totalEntradas,
      totalSalidas,
      totalAjustes,
      valueImpact,
      mostActiveProduct,
      averageMovementValue
    })
  }

  const applyFilters = () => {
    const filtered = movements.filter(movement => {
      const matchesSearch = movement.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           movement.productSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           movement.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           movement.reference?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesType = filterType === 'all' || movement.type === filterType
      const matchesUser = filterUser === 'all' || movement.userName === filterUser
      
      let matchesDate = true
      if (filterDateFrom) {
        matchesDate = matchesDate && movement.timestamp >= new Date(filterDateFrom)
      }
      if (filterDateTo) {
        matchesDate = matchesDate && movement.timestamp <= new Date(filterDateTo + 'T23:59:59')
      }
      
      return matchesSearch && matchesType && matchesUser && matchesDate
    })

    setFilteredMovements(filtered)
    setCurrentPage(1)
  }

  const exportMovements = () => {
    const csvContent = [
      ['Fecha', 'Producto', 'SKU', 'Tipo', 'Cantidad', 'Stock Anterior', 'Stock Nuevo', 'Motivo', 'Usuario', 'Referencia'],
      ...filteredMovements.map(m => [
        m.timestamp.toLocaleString(),
        m.productName,
        m.productSku,
        m.type,
        m.quantity.toString(),
        m.previousStock.toString(),
        m.newStock.toString(),
        m.reason,
        m.userName,
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

  // Paginación
  const totalPages = Math.ceil(filteredMovements.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentMovements = filteredMovements.slice(startIndex, endIndex)

  const uniqueUsers = Array.from(new Set(movements.map(m => m.userName)))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Movimientos de Stock</h2>
          <p className="text-gray-600">Historial detallado y análisis de movimientos de inventario</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportMovements}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Resumen */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Movimientos</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.totalMovements}</p>
                </div>
                <ArrowUpDown className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Entradas</p>
                  <p className="text-2xl font-bold text-green-600">{summary.totalEntradas}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Salidas</p>
                  <p className="text-2xl font-bold text-red-600">{summary.totalSalidas}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Impacto Valor</p>
                  <p className="text-2xl font-bold text-purple-600">${summary.valueImpact.toLocaleString()}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Producto, SKU, motivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Movimiento</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
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
              <Label>Usuario</Label>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueUsers.map(user => (
                    <SelectItem key={user} value={user}>{user}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha Desde</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Movimientos */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Historial de Movimientos</CardTitle>
              <CardDescription>
                Mostrando {currentMovements.length} de {filteredMovements.length} movimientos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {currentMovements.map(movement => {
              const approval = getApprovalStatus(movement)
              return (
                <div key={movement.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg ${getMovementTypeColor(movement.type)}`}>
                        {getMovementIcon(movement.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium">{movement.productName}</h4>
                          <Badge variant="outline">{movement.productSku}</Badge>
                          <Badge className={getMovementTypeColor(movement.type)}>
                            {movement.type.toUpperCase()}
                          </Badge>
                          <div className={`flex items-center space-x-1 ${approval.color}`}>
                            {approval.icon}
                            <span className="text-xs">{approval.text}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{movement.reason}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {movement.timestamp.toLocaleDateString()}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {movement.timestamp.toLocaleTimeString()}
                          </span>
                          <span className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            {movement.userName}
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
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`text-lg font-semibold ${
                          movement.type === 'entrada' || movement.type === 'devolucion' ? 'text-green-600' : 'text-red-600'
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
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        {movement.previousStock} → {movement.newStock}
                      </p>
                      {movement.cost && (
                        <p className="text-xs text-gray-500">
                          Valor: ${(movement.quantity * movement.cost).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Detalle del Movimiento
            </DialogTitle>
            <DialogDescription>
              Información completa del movimiento de stock
            </DialogDescription>
          </DialogHeader>

          {selectedMovement && (
            <div className="space-y-6">
              {/* Información del Producto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Producto</Label>
                  <p className="font-semibold">{selectedMovement.productName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">SKU</Label>
                  <p className="font-semibold">{selectedMovement.productSku}</p>
                </div>
              </div>

              {/* Información del Movimiento */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Tipo</Label>
                  <Badge className={getMovementTypeColor(selectedMovement.type)}>
                    {selectedMovement.type.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Cantidad</Label>
                  <p className="font-semibold text-lg">
                    {(selectedMovement.type === 'entrada' || selectedMovement.type === 'devolucion') ? '+' : '-'}
                    {Math.abs(selectedMovement.quantity)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Estado</Label>
                  <div className={`flex items-center space-x-1 ${getApprovalStatus(selectedMovement).color}`}>
                    {getApprovalStatus(selectedMovement).icon}
                    <span className="font-semibold">{getApprovalStatus(selectedMovement).text}</span>
                  </div>
                </div>
              </div>

              {/* Stock */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Stock Anterior</Label>
                  <p className="font-semibold">{selectedMovement.previousStock}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Cambio</Label>
                  <p className={`font-semibold ${
                    selectedMovement.quantity > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {selectedMovement.quantity > 0 ? '+' : ''}{selectedMovement.quantity}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Stock Final</Label>
                  <p className="font-semibold">{selectedMovement.newStock}</p>
                </div>
              </div>

              {/* Información Adicional */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Motivo</Label>
                  <p className="mt-1 p-3 bg-gray-50 rounded-lg">{selectedMovement.reason}</p>
                </div>

                {selectedMovement.notes && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Notas</Label>
                    <p className="mt-1 p-3 bg-gray-50 rounded-lg">{selectedMovement.notes}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {selectedMovement.reference && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Referencia</Label>
                      <p className="font-semibold">{selectedMovement.reference}</p>
                    </div>
                  )}
                  {selectedMovement.location && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Ubicación</Label>
                      <p className="font-semibold">{selectedMovement.location}</p>
                    </div>
                  )}
                </div>

                {selectedMovement.cost && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Costo Unitario</Label>
                      <p className="font-semibold">${selectedMovement.cost.toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Valor Total</Label>
                      <p className="font-semibold">${(selectedMovement.quantity * selectedMovement.cost).toLocaleString()}</p>
                    </div>
                  </div>
                )}

                {selectedMovement.supplier && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Proveedor</Label>
                    <p className="font-semibold">{selectedMovement.supplier}</p>
                  </div>
                )}
              </div>

              {/* Información de Auditoría */}
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-900 mb-3">Información de Auditoría</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-gray-600">Registrado por</Label>
                    <p className="font-semibold">{selectedMovement.userName}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Fecha y Hora</Label>
                    <p className="font-semibold">{selectedMovement.timestamp.toLocaleString()}</p>
                  </div>
                  {selectedMovement.approvedBy && (
                    <>
                      <div>
                        <Label className="text-gray-600">Aprobado por</Label>
                        <p className="font-semibold">{selectedMovement.approvedBy}</p>
                      </div>
                      <div>
                        <Label className="text-gray-600">Fecha de Aprobación</Label>
                        <p className="font-semibold">{selectedMovement.approvedAt?.toLocaleString()}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Cerrar
            </Button>
            {selectedMovement?.reference && (
              <Button variant="outline">
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