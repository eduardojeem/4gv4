'use client'

import { useState, useEffect } from 'react'
import { 
  AlertTriangle, 
  Package, 
  Calendar, 
  TrendingDown, 
  Bell, 
  X, 
  Eye,
  RefreshCw,
  Settings,
  Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

interface Product {
  id: string
  name: string
  sku: string
  category: string
  stock: number
  minStock: number
  maxStock: number
  price: number
  expiryDate?: Date
  lastRestocked?: Date
  supplier: string
}

interface AlertSettings {
  lowStockEnabled: boolean
  lowStockThreshold: number
  expiryEnabled: boolean
  expiryDaysWarning: number
  overstockEnabled: boolean
  overstockThreshold: number
  noMovementEnabled: boolean
  noMovementDays: number
}

interface InventoryAlertsProps {
  products: Product[]
  onProductUpdate?: (productId: string, updates: Partial<Product>) => void
}

const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Smartphone Galaxy S24',
    sku: 'SGS24-001',
    category: 'Electrónicos',
    stock: 3,
    minStock: 10,
    maxStock: 50,
    price: 899.99,
    expiryDate: new Date('2024-12-15'),
    lastRestocked: new Date('2024-01-15'),
    supplier: 'Samsung'
  },
  {
    id: '2',
    name: 'Laptop Dell XPS 13',
    sku: 'DXP13-002',
    category: 'Computadoras',
    stock: 1,
    minStock: 5,
    maxStock: 25,
    price: 1299.99,
    lastRestocked: new Date('2023-11-20'),
    supplier: 'Dell'
  },
  {
    id: '3',
    name: 'Auriculares Sony WH-1000XM4',
    sku: 'SWH-003',
    category: 'Audio',
    stock: 45,
    minStock: 15,
    maxStock: 30,
    price: 349.99,
    lastRestocked: new Date('2024-02-10'),
    supplier: 'Sony'
  },
  {
    id: '4',
    name: 'Tablet iPad Air',
    sku: 'IPA-004',
    category: 'Tablets',
    stock: 0,
    minStock: 8,
    maxStock: 40,
    price: 599.99,
    expiryDate: new Date('2024-11-30'),
    lastRestocked: new Date('2024-01-05'),
    supplier: 'Apple'
  }
]

export function InventoryAlerts({ products = mockProducts, onProductUpdate }: InventoryAlertsProps) {
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    lowStockEnabled: true,
    lowStockThreshold: 10,
    expiryEnabled: true,
    expiryDaysWarning: 30,
    overstockEnabled: true,
    overstockThreshold: 80,
    noMovementEnabled: true,
    noMovementDays: 90
  })

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])

  // Calcular alertas
  const lowStockProducts = products.filter(product => 
    alertSettings.lowStockEnabled && 
    product.stock <= Math.max(product.minStock, alertSettings.lowStockThreshold) &&
    !dismissedAlerts.includes(`low-stock-${product.id}`)
  )

  const outOfStockProducts = products.filter(product => 
    product.stock === 0 &&
    !dismissedAlerts.includes(`out-of-stock-${product.id}`)
  )

  const expiringProducts = products.filter(product => {
    if (!alertSettings.expiryEnabled || !product.expiryDate) return false
    const daysUntilExpiry = Math.ceil((product.expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= alertSettings.expiryDaysWarning && 
           daysUntilExpiry > 0 &&
           !dismissedAlerts.includes(`expiry-${product.id}`)
  })

  const expiredProducts = products.filter(product => {
    if (!product.expiryDate) return false
    return product.expiryDate < new Date() &&
           !dismissedAlerts.includes(`expired-${product.id}`)
  })

  const overstockedProducts = products.filter(product => {
    if (!alertSettings.overstockEnabled) return false
    const overstockThreshold = product.maxStock * (alertSettings.overstockThreshold / 100)
    return product.stock > overstockThreshold &&
           !dismissedAlerts.includes(`overstock-${product.id}`)
  })

  const noMovementProducts = products.filter(product => {
    if (!alertSettings.noMovementEnabled || !product.lastRestocked) return false
    const daysSinceRestock = Math.ceil((new Date().getTime() - product.lastRestocked.getTime()) / (1000 * 60 * 60 * 24))
    return daysSinceRestock > alertSettings.noMovementDays &&
           !dismissedAlerts.includes(`no-movement-${product.id}`)
  })

  const totalAlerts = lowStockProducts.length + outOfStockProducts.length + 
                     expiringProducts.length + expiredProducts.length + 
                     overstockedProducts.length + noMovementProducts.length

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => [...prev, alertId])
  }

  const getStockPercentage = (product: Product) => {
    if (product.maxStock === 0) return 0
    return (product.stock / product.maxStock) * 100
  }

  const getStockColor = (product: Product) => {
    const percentage = getStockPercentage(product)
    if (percentage === 0) return 'bg-red-500'
    if (percentage <= 20) return 'bg-red-400'
    if (percentage <= 50) return 'bg-yellow-400'
    return 'bg-green-500'
  }

  const AlertCard = ({ 
    title, 
    products, 
    icon: Icon, 
    variant, 
    alertType 
  }: { 
    title: string
    products: Product[]
    icon: any
    variant: 'destructive' | 'default' | 'secondary'
    alertType: string
  }) => {
    if (products.length === 0) return null

    return (
      <Alert className={`${variant === 'destructive' ? 'border-red-200 bg-red-50' : 
                         variant === 'secondary' ? 'border-yellow-200 bg-yellow-50' : 
                         'border-blue-200 bg-blue-50'}`}>
        <Icon className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          {title}
          <Badge variant={variant === 'destructive' ? 'destructive' : 'secondary'}>
            {products.length}
          </Badge>
        </AlertTitle>
        <AlertDescription>
          <div className="mt-3 space-y-2">
            {products.slice(0, 3).map((product) => (
              <div key={product.id} className="flex items-center justify-between p-2 bg-white rounded border">
                <div className="flex-1">
                  <div className="font-medium text-sm">{product.name}</div>
                  <div className="text-xs text-muted-foreground">SKU: {product.sku}</div>
                  {alertType === 'stock' && (
                    <div className="flex items-center gap-2 mt-1">
                      <Progress 
                        value={getStockPercentage(product)} 
                        className="h-2 flex-1"
                      />
                      <span className="text-xs font-medium">
                        {product.stock}/{product.maxStock}
                      </span>
                    </div>
                  )}
                  {alertType === 'expiry' && product.expiryDate && (
                    <div className="text-xs text-orange-600 mt-1">
                      Vence: {product.expiryDate.toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissAlert(`${alertType}-${product.id}`)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {products.length > 3 && (
              <div className="text-sm text-muted-foreground text-center py-2">
                ... y {products.length - 3} productos más
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con resumen */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              <CardTitle>Alertas de Inventario</CardTitle>
              {totalAlerts > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {totalAlerts} alerta{totalAlerts > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDismissedAlerts([])}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Configuración de Alertas</DialogTitle>
                    <DialogDescription>
                      Personaliza los umbrales y tipos de alertas de inventario
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                    {/* Stock bajo */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="low-stock" className="text-base font-medium">
                          Alertas de stock bajo
                        </Label>
                        <Switch
                          id="low-stock"
                          checked={alertSettings.lowStockEnabled}
                          onCheckedChange={(checked) => 
                            setAlertSettings(prev => ({ ...prev, lowStockEnabled: checked }))
                          }
                        />
                      </div>
                      {alertSettings.lowStockEnabled && (
                        <div className="ml-4">
                          <Label htmlFor="low-stock-threshold">Umbral de stock bajo</Label>
                          <Input
                            id="low-stock-threshold"
                            type="number"
                            value={alertSettings.lowStockThreshold}
                            onChange={(e) => 
                              setAlertSettings(prev => ({ 
                                ...prev, 
                                lowStockThreshold: parseInt(e.target.value) || 0 
                              }))
                            }
                            className="w-24"
                          />
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Productos vencidos */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="expiry" className="text-base font-medium">
                          Alertas de vencimiento
                        </Label>
                        <Switch
                          id="expiry"
                          checked={alertSettings.expiryEnabled}
                          onCheckedChange={(checked) => 
                            setAlertSettings(prev => ({ ...prev, expiryEnabled: checked }))
                          }
                        />
                      </div>
                      {alertSettings.expiryEnabled && (
                        <div className="ml-4">
                          <Label htmlFor="expiry-days">Días de anticipación</Label>
                          <Input
                            id="expiry-days"
                            type="number"
                            value={alertSettings.expiryDaysWarning}
                            onChange={(e) => 
                              setAlertSettings(prev => ({ 
                                ...prev, 
                                expiryDaysWarning: parseInt(e.target.value) || 0 
                              }))
                            }
                            className="w-24"
                          />
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Sobrestock */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="overstock" className="text-base font-medium">
                          Alertas de sobrestock
                        </Label>
                        <Switch
                          id="overstock"
                          checked={alertSettings.overstockEnabled}
                          onCheckedChange={(checked) => 
                            setAlertSettings(prev => ({ ...prev, overstockEnabled: checked }))
                          }
                        />
                      </div>
                      {alertSettings.overstockEnabled && (
                        <div className="ml-4">
                          <Label htmlFor="overstock-threshold">Porcentaje del stock máximo</Label>
                          <Input
                            id="overstock-threshold"
                            type="number"
                            value={alertSettings.overstockThreshold}
                            onChange={(e) => 
                              setAlertSettings(prev => ({ 
                                ...prev, 
                                overstockThreshold: parseInt(e.target.value) || 0 
                              }))
                            }
                            className="w-24"
                            min="0"
                            max="100"
                          />
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Sin movimiento */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="no-movement" className="text-base font-medium">
                          Productos sin movimiento
                        </Label>
                        <Switch
                          id="no-movement"
                          checked={alertSettings.noMovementEnabled}
                          onCheckedChange={(checked) => 
                            setAlertSettings(prev => ({ ...prev, noMovementEnabled: checked }))
                          }
                        />
                      </div>
                      {alertSettings.noMovementEnabled && (
                        <div className="ml-4">
                          <Label htmlFor="no-movement-days">Días sin restock</Label>
                          <Input
                            id="no-movement-days"
                            type="number"
                            value={alertSettings.noMovementDays}
                            onChange={(e) => 
                              setAlertSettings(prev => ({ 
                                ...prev, 
                                noMovementDays: parseInt(e.target.value) || 0 
                              }))
                            }
                            className="w-24"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setIsSettingsOpen(false)}>
                      Guardar configuración
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        {totalAlerts === 0 && (
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">¡Todo en orden!</p>
              <p className="text-sm">No hay alertas de inventario en este momento</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Alertas */}
      {totalAlerts > 0 && (
        <div className="space-y-4">
          <AlertCard
            title="Productos agotados"
            products={outOfStockProducts}
            icon={AlertTriangle}
            variant="destructive"
            alertType="out-of-stock"
          />

          <AlertCard
            title="Stock bajo"
            products={lowStockProducts}
            icon={TrendingDown}
            variant="secondary"
            alertType="low-stock"
          />

          <AlertCard
            title="Productos vencidos"
            products={expiredProducts}
            icon={Calendar}
            variant="destructive"
            alertType="expired"
          />

          <AlertCard
            title="Próximos a vencer"
            products={expiringProducts}
            icon={Calendar}
            variant="secondary"
            alertType="expiry"
          />

          <AlertCard
            title="Sobrestock"
            products={overstockedProducts}
            icon={Package}
            variant="default"
            alertType="overstock"
          />

          <AlertCard
            title="Sin movimiento"
            products={noMovementProducts}
            icon={TrendingDown}
            variant="default"
            alertType="no-movement"
          />
        </div>
      )}
    </div>
  )
}