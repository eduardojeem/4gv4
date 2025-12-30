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
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Plus, 
  Minus, 
  RefreshCw,
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Filter,
  Download,
  Eye,
  Settings,
  BarChart3,
  History
} from 'lucide-react'
import StockMovements from './stock-movements'

// Interfaces
interface StockMovement {
  id: string
  productId: string
  productName: string
  productSku: string
  type: 'entrada' | 'salida' | 'ajuste' | 'transferencia'
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
}

interface StockAlert {
  id: string
  productId: string
  productName: string
  productSku: string
  type: 'low_stock' | 'out_of_stock' | 'overstock' | 'expiring'
  currentStock: number
  threshold: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  isActive: boolean
  createdAt: Date
  acknowledgedAt?: Date
  acknowledgedBy?: string
}

interface Product {
  id: string
  name: string
  sku: string
  category: string
  stock: number
  minStock: number
  maxStock: number
  cost: number
  price: number
  supplier: string
}

const StockControl: React.FC = () => {
  // Estados
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false)
  const [isAlertSettingsOpen, setIsAlertSettingsOpen] = useState(false)
  const [movementType, setMovementType] = useState<'entrada' | 'salida' | 'ajuste'>('entrada')
  const [movementQuantity, setMovementQuantity] = useState<number>(0)
  const [movementReason, setMovementReason] = useState('')
  const [movementReference, setMovementReference] = useState('')
  const [movementCost, setMovementCost] = useState<number>(0)
  const [movementSupplier, setMovementSupplier] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  // Datos mock
  const mockProducts: Product[] = [
    {
      id: '1',
      name: 'iPhone 15 Pro',
      sku: 'IPH15P-128',
      category: 'Smartphones',
      stock: 5,
      minStock: 10,
      maxStock: 100,
      cost: 800,
      price: 1200,
      supplier: 'Apple Inc.'
    },
    {
      id: '2',
      name: 'Samsung Galaxy S24',
      sku: 'SGS24-256',
      category: 'Smartphones',
      stock: 0,
      minStock: 8,
      maxStock: 80,
      cost: 700,
      price: 1100,
      supplier: 'Samsung Electronics'
    },
    {
      id: '3',
      name: 'MacBook Air M3',
      sku: 'MBA-M3-512',
      category: 'Laptops',
      stock: 15,
      minStock: 5,
      maxStock: 50,
      cost: 1200,
      price: 1800,
      supplier: 'Apple Inc.'
    }
  ]

  const mockMovements: StockMovement[] = [
    {
      id: '1',
      productId: '1',
      productName: 'iPhone 15 Pro',
      productSku: 'IPH15P-128',
      type: 'entrada',
      quantity: 20,
      previousStock: 5,
      newStock: 25,
      reason: 'Reposición de inventario',
      reference: 'PO-2024-001',
      userId: 'user1',
      userName: 'Juan Pérez',
      timestamp: new Date('2024-01-15T10:30:00'),
      cost: 800,
      supplier: 'Apple Inc.'
    },
    {
      id: '2',
      productId: '1',
      productName: 'iPhone 15 Pro',
      productSku: 'IPH15P-128',
      type: 'salida',
      quantity: 20,
      previousStock: 25,
      newStock: 5,
      reason: 'Venta al cliente',
      reference: 'VT-2024-045',
      userId: 'user2',
      userName: 'María García',
      timestamp: new Date('2024-01-16T14:15:00')
    },
    {
      id: '3',
      productId: '2',
      productName: 'Samsung Galaxy S24',
      productSku: 'SGS24-256',
      type: 'salida',
      quantity: 8,
      previousStock: 8,
      newStock: 0,
      reason: 'Venta al cliente',
      reference: 'VT-2024-046',
      userId: 'user2',
      userName: 'María García',
      timestamp: new Date('2024-01-16T16:20:00')
    }
  ]

  const mockAlerts: StockAlert[] = [
    {
      id: '1',
      productId: '1',
      productName: 'iPhone 15 Pro',
      productSku: 'IPH15P-128',
      type: 'low_stock',
      currentStock: 5,
      threshold: 10,
      severity: 'medium',
      message: 'Stock por debajo del mínimo recomendado',
      isActive: true,
      createdAt: new Date('2024-01-16T16:25:00')
    },
    {
      id: '2',
      productId: '2',
      productName: 'Samsung Galaxy S24',
      productSku: 'SGS24-256',
      type: 'out_of_stock',
      currentStock: 0,
      threshold: 8,
      severity: 'critical',
      message: 'Producto agotado - Requiere reposición inmediata',
      isActive: true,
      createdAt: new Date('2024-01-16T16:20:00')
    }
  ]

  // Efectos
  useEffect(() => {
    setProducts(mockProducts)
    setMovements(mockMovements)
    setAlerts(mockAlerts)
  }, [])

  // Funciones utilitarias
  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'entrada': return 'bg-green-100 text-green-800'
      case 'salida': return 'bg-red-100 text-red-800'
      case 'ajuste': return 'bg-blue-100 text-blue-800'
      case 'transferencia': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'entrada': return <TrendingUp className="h-4 w-4" />
      case 'salida': return <TrendingDown className="h-4 w-4" />
      case 'ajuste': return <ArrowUpDown className="h-4 w-4" />
      case 'transferencia': return <RefreshCw className="h-4 w-4" />
      default: return <Package className="h-4 w-4" />
    }
  }

  // Funciones de manejo
  const handleCreateMovement = async () => {
    if (!selectedProduct || movementQuantity <= 0) return

    setIsLoading(true)
    
    // Simular API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    const newMovement: StockMovement = {
      id: Date.now().toString(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productSku: selectedProduct.sku,
      type: movementType,
      quantity: movementQuantity,
      previousStock: selectedProduct.stock,
      newStock: movementType === 'entrada' 
        ? selectedProduct.stock + movementQuantity 
        : selectedProduct.stock - movementQuantity,
      reason: movementReason,
      reference: movementReference,
      userId: 'current-user',
      userName: 'Usuario Actual',
      timestamp: new Date(),
      cost: movementCost || undefined,
      supplier: movementSupplier || undefined
    }

    setMovements(prev => [newMovement, ...prev])
    
    // Actualizar stock del producto
    setProducts(prev => prev.map(p => 
      p.id === selectedProduct.id 
        ? { ...p, stock: newMovement.newStock }
        : p
    ))

    // Resetear formulario
    setIsMovementDialogOpen(false)
    setSelectedProduct(null)
    setMovementQuantity(0)
    setMovementReason('')
    setMovementReference('')
    setMovementCost(0)
    setMovementSupplier('')
    setIsLoading(false)
  }

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { 
            ...alert, 
            isActive: false, 
            acknowledgedAt: new Date(),
            acknowledgedBy: 'Usuario Actual'
          }
        : alert
    ))
  }

  const filteredMovements = movements.filter(movement => {
    if (filterType !== 'all' && movement.type !== filterType) return false
    if (filterDate && !movement.timestamp.toISOString().startsWith(filterDate)) return false
    return true
  })

  const activeAlerts = alerts.filter(alert => alert.isActive)
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Control de Stock</h2>
          <p className="text-gray-600">Gestión avanzada de inventario y movimientos</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setIsAlertSettingsOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configurar Alertas
          </Button>
          <Button 
            onClick={() => setIsMovementDialogOpen(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Movimiento
          </Button>
        </div>
      </div>

      {/* Alertas Críticas */}
      {criticalAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-900 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Alertas Críticas ({criticalAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {criticalAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-red-200">
                  <div className="flex items-center space-x-3">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-900">{alert.productName}</p>
                      <p className="text-sm text-red-700">{alert.message}</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Reconocer
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Alertas Activas</p>
                <p className="text-2xl font-bold text-orange-600">{activeAlerts.length}</p>
              </div>
              <Bell className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Movimientos Hoy</p>
                <p className="text-2xl font-bold text-blue-600">
                  {movements.filter(m => 
                    m.timestamp.toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
              <ArrowUpDown className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Productos Críticos</p>
                <p className="text-2xl font-bold text-red-600">{criticalAlerts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Stock Total</p>
                <p className="text-2xl font-bold text-green-600">
                  {products.reduce((sum, p) => sum + p.stock, 0)}
                </p>
              </div>
              <Package className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="movements" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="movements" className="flex items-center space-x-2">
            <ArrowUpDown className="h-4 w-4" />
            <span>Movimientos</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2">
            <History className="h-4 w-4" />
            <span>Historial</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Alertas</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Análisis</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Movimientos */}
        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Historial de Movimientos</CardTitle>
                  <CardDescription>Registro detallado de todos los movimientos de stock</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filtrar por tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="entrada">Entradas</SelectItem>
                      <SelectItem value="salida">Salidas</SelectItem>
                      <SelectItem value="ajuste">Ajustes</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-40"
                  />
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredMovements.map(movement => (
                  <div key={movement.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-lg ${getMovementTypeColor(movement.type)}`}>
                          {getMovementIcon(movement.type)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">{movement.productName}</h4>
                            <Badge variant="outline">{movement.productSku}</Badge>
                            <Badge className={getMovementTypeColor(movement.type)}>
                              {movement.type.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{movement.reason}</p>
                          {movement.reference && (
                            <p className="text-xs text-gray-500">Ref: {movement.reference}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-semibold">
                            {movement.type === 'entrada' ? '+' : '-'}{movement.quantity}
                          </span>
                          <span className="text-sm text-gray-500">
                            ({movement.previousStock} → {movement.newStock})
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {movement.timestamp.toLocaleString()} - {movement.userName}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Historial Detallado */}
        <TabsContent value="history">
          <StockMovements />
        </TabsContent>

        {/* Tab: Alertas */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Alertas</CardTitle>
              <CardDescription>Configuración y seguimiento de alertas de inventario</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.map(alert => (
                  <div key={alert.id} className={`border rounded-lg p-4 ${alert.isActive ? '' : 'opacity-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-lg ${getAlertSeverityColor(alert.severity)}`}>
                          {alert.severity === 'critical' ? <XCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">{alert.productName}</h4>
                            <Badge variant="outline">{alert.productSku}</Badge>
                            <Badge className={getAlertSeverityColor(alert.severity)}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{alert.message}</p>
                          <p className="text-xs text-gray-500">
                            Stock actual: {alert.currentStock} | Umbral: {alert.threshold}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {alert.isActive ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => acknowledgeAlert(alert.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Reconocer
                          </Button>
                        ) : (
                          <div className="text-xs text-gray-500">
                            <p>Reconocida</p>
                            <p>{alert.acknowledgedAt?.toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Análisis */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Productos con Stock Bajo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {products.filter(p => p.stock <= p.minStock).map(product => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-yellow-700">{product.stock} / {product.minStock}</p>
                        <p className="text-xs text-gray-500">Stock / Mínimo</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Movimientos Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {movements.slice(0, 5).map(movement => (
                    <div key={movement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`p-1 rounded ${getMovementTypeColor(movement.type)}`}>
                          {getMovementIcon(movement.type)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{movement.productName}</p>
                          <p className="text-xs text-gray-500">{movement.timestamp.toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">
                          {movement.type === 'entrada' ? '+' : '-'}{movement.quantity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Nuevo Movimiento */}
      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <ArrowUpDown className="h-5 w-5 mr-2" />
              Registrar Movimiento de Stock
            </DialogTitle>
            <DialogDescription>
              Registra una entrada, salida o ajuste de inventario
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Producto</Label>
                <Select 
                  value={selectedProduct?.id || ''} 
                  onValueChange={(value) => setSelectedProduct(products.find(p => p.id === value) || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku}) - Stock: {product.stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Movimiento</Label>
                <Select value={movementType} onValueChange={(value: any) => setMovementType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="salida">Salida</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  value={movementQuantity}
                  onChange={(e) => setMovementQuantity(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Referencia</Label>
                <Input
                  value={movementReference}
                  onChange={(e) => setMovementReference(e.target.value)}
                  placeholder="PO-2024-001"
                />
              </div>
            </div>

            {movementType === 'entrada' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Costo Unitario</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={movementCost}
                    onChange={(e) => setMovementCost(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Input
                    value={movementSupplier}
                    onChange={(e) => setMovementSupplier(e.target.value)}
                    placeholder="Nombre del proveedor"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                placeholder="Describe el motivo del movimiento"
                rows={3}
              />
            </div>

            {selectedProduct && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Resumen del Movimiento</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700">Stock Actual</p>
                    <p className="font-semibold">{selectedProduct.stock}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Cambio</p>
                    <p className="font-semibold">
                      {movementType === 'entrada' ? '+' : '-'}{movementQuantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-700">Stock Final</p>
                    <p className="font-semibold">
                      {movementType === 'entrada' 
                        ? selectedProduct.stock + movementQuantity 
                        : selectedProduct.stock - movementQuantity}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMovementDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateMovement}
              disabled={!selectedProduct || movementQuantity <= 0 || !movementReason || isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Registrando...' : 'Registrar Movimiento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default StockControl