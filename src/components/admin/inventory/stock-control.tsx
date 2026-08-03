'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { useBranch } from '@/contexts/branch-context'
import {
  applyBranchInventoryToProducts,
  loadBranchInventoryStockMap,
  type BranchInventoryClient,
} from '@/lib/branches/inventory'
import {
  getStockMovementProjection,
  validateStockMovement,
  type StockMovementType,
} from '@/lib/inventory/stock-movement'
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Plus, 
  RefreshCw,
  ArrowRight,
  Bell,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Download,
  BarChart3,
  History,
  Building2,
  PackagePlus,
  PackageMinus,
  SlidersHorizontal,
  MoveRight,
  Search,
  Minus
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

interface ProductQueryRow {
  id: string
  name: string
  sku?: string | null
  stock_quantity?: number | null
  min_stock?: number | null
  max_stock?: number | null
  purchase_price?: number | null
  sale_price?: number | null
  category?: { name?: string | null } | null
  supplier?: { name?: string | null } | null
}

const PRODUCT_PAGE_SIZE = 25

const MOVEMENT_TYPE_OPTIONS = [
  { value: 'entrada', label: 'Entrada', description: 'Suma unidades recibidas', icon: PackagePlus, activeClass: 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-300' },
  { value: 'salida', label: 'Salida', description: 'Descuenta unidades', icon: PackageMinus, activeClass: 'border-rose-600 bg-rose-50 text-rose-700 dark:border-rose-500 dark:bg-rose-500/10 dark:text-rose-300' },
  { value: 'ajuste', label: 'Ajuste', description: 'Define el stock contado', icon: SlidersHorizontal, activeClass: 'border-amber-600 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-500/10 dark:text-amber-300' },
  { value: 'transferencia', label: 'Transferencia', description: 'Mueve entre sucursales', icon: MoveRight, activeClass: 'border-violet-600 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-500/10 dark:text-violet-300' },
] as const satisfies ReadonlyArray<{
  value: StockMovementType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  activeClass: string
}>

const MOVEMENT_REASON_SUGGESTIONS: Record<StockMovementType, string[]> = {
  entrada: ['Compra a proveedor', 'Devolución recibida', 'Carga inicial'],
  salida: ['Venta manual', 'Producto dañado', 'Uso interno'],
  ajuste: ['Conteo físico', 'Corrección de inventario', 'Regularización'],
  transferencia: ['Reposición de sucursal', 'Traslado interno', 'Balance de stock'],
}

const StockControl: React.FC = () => {
  // Estados
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false)
  const [movementType, setMovementType] = useState<StockMovementType>('entrada')
  const [movementQuantity, setMovementQuantity] = useState<number>(0)
  const [movementReason, setMovementReason] = useState('')
  const [movementReference, setMovementReference] = useState('')
  const [transferToBranchId, setTransferToBranchId] = useState('')
  const [movementError, setMovementError] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('')
  const [productSearchInput, setProductSearchInput] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [productTotalCount, setProductTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  
  const supabase = createClient()
  const { branches, selectedBranch, selectedBranchId } = useBranch()
  const destinationBranch = branches.find((branch) => branch.id === transferToBranchId) || null
  const movementProjection = useMemo(
    () => getStockMovementProjection(movementType, selectedProduct?.stock || 0, movementQuantity),
    [movementQuantity, movementType, selectedProduct?.stock]
  )
  const movementValidationError = selectedProduct
    ? validateStockMovement({
        type: movementType,
        currentStock: selectedProduct.stock,
        quantity: movementQuantity,
        reason: movementReason,
        sourceBranchId: selectedBranchId,
        destinationBranchId: transferToBranchId,
      })
    : 'Selecciona un producto.'
  const canSubmitMovement = !isLoading && !movementValidationError
  const selectedMovementOption = MOVEMENT_TYPE_OPTIONS.find((option) => option.value === movementType)!
  const SelectedMovementIcon = selectedMovementOption.icon

  // Cargar datos de Supabase
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      // 1. Cargar Productos
      const productFrom = (productPage - 1) * PRODUCT_PAGE_SIZE
      const productTo = productFrom + PRODUCT_PAGE_SIZE - 1
      let productsQuery = supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          stock_quantity,
          min_stock,
          max_stock,
          purchase_price,
          sale_price,
          category:categories(name),
          supplier:suppliers(name)
        `, { count: 'exact' })
        .order('name', { ascending: true })
        .range(productFrom, productTo)

      const normalizedSearch = productSearch.trim()
      if (normalizedSearch) {
        productsQuery = productsQuery.or(`name.ilike.%${normalizedSearch}%,sku.ilike.%${normalizedSearch}%`)
      }

      const { data: productsData, error: productsError, count: productsCount } = await productsQuery
      
      if (productsError) throw productsError
      setProductTotalCount(productsCount || 0)

      const productRows = (productsData || []) as unknown as ProductQueryRow[]
      const { stockMap, branchScoped } = await loadBranchInventoryStockMap(
        supabase as unknown as BranchInventoryClient,
        selectedBranchId,
        productRows.map((product) => product.id)
      )
      const branchAwareProducts = applyBranchInventoryToProducts(productRows, stockMap, branchScoped)

      const formattedProducts: Product[] = branchAwareProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        category: p.category?.name || 'Sin Categoría',
        stock: p.stock_quantity || 0,
        minStock: p.min_stock || 0,
        maxStock: p.max_stock || 100,
        cost: p.purchase_price || 0,
        price: p.sale_price || 0,
        supplier: p.supplier?.name || 'Sin Proveedor'
      }))
      
      setProducts(formattedProducts)

      // 2. Cargar Movimientos
      let movementsQuery = supabase
        .from('product_movements')
        .select(`
          *,
          product:products(name, sku)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (selectedBranchId) {
        movementsQuery = movementsQuery.eq('branch_id', selectedBranchId)
      }

      const { data: movementsData, error: movementsError } = await movementsQuery

      if (movementsError && movementsError.code !== '42P01') { // Ignorar si la tabla no existe aún
        console.error('Error loading movements:', movementsError)
      }

      if (movementsData) {
        const formattedMovements: StockMovement[] = movementsData.map(m => ({
          id: m.id,
          productId: m.product_id,
          productName: m.product?.name || 'Desconocido',
          productSku: m.product?.sku || '',
          type: (m.movement_type === 'entry' || m.movement_type === 'entrada' || m.movement_type === 'in') ? 'entrada' :
                (m.movement_type === 'exit' || m.movement_type === 'salida' || m.movement_type === 'sale' || m.movement_type === 'out') ? 'salida' :
                (m.movement_type === 'transfer' || m.movement_type === 'transferencia') ? 'transferencia' : 'ajuste',
          quantity: m.quantity,
          previousStock: m.previous_stock,
          newStock: m.new_stock,
          reason: m.notes || m.movement_type,
          reference: m.reference_id || '',
          userId: m.user_id || 'system',
          userName: 'Sistema', // Podríamos cargar el usuario si fuera necesario
          timestamp: new Date(m.created_at),
          cost: m.unit_cost,
          supplier: '' // No siempre disponible en movimiento
        }))
        setMovements(formattedMovements)
      }

      // 3. Cargar Alertas (o generarlas basadas en stock bajo)
      // Primero intentamos cargar de tabla de alertas
      let alertsQuery = supabase
        .from('product_alerts')
        .select(`
          *,
          product:products(name, sku, stock_quantity)
        `)
        .eq('is_resolved', false)
        .in('alert_type', ['low_stock', 'out_of_stock'])

      if (selectedBranchId) {
        alertsQuery = alertsQuery.eq('branch_id', selectedBranchId)
      }

      const { data: alertsData, error: alertsError } = await alertsQuery
      
      if (!alertsError && alertsData) {
        const branchStockByProductId = new Map(formattedProducts.map((product) => [product.id, product.stock]))
        const formattedAlerts: StockAlert[] = alertsData.map(a => ({
          id: a.id,
          productId: a.product_id,
          productName: a.product?.name || 'Desconocido',
          productSku: a.product?.sku || '',
          type: a.alert_type === 'out_of_stock'
            ? 'out_of_stock'
            : a.alert_type === 'overstock'
              ? 'overstock'
              : a.alert_type === 'expiring'
                ? 'expiring'
                : 'low_stock',
          currentStock: (branchStockByProductId.get(a.product_id) ?? a.product?.stock_quantity) || 0,
          threshold: 5, // Valor por defecto o del producto si estuviera disponible en join
          severity: a.alert_type === 'out_of_stock' ? 'critical' : 'medium',
          message: a.message,
          isActive: !a.is_resolved,
          createdAt: new Date(a.created_at)
        }))
        setAlerts(formattedAlerts)
      } else {
        // Fallback: Generar alertas locales basadas en productos cargados
        const localAlerts: StockAlert[] = formattedProducts
          .filter(p => p.stock <= p.minStock)
          .slice(0, 25)
          .map(p => ({
            id: `local-alert-${p.id}`,
            productId: p.id,
            productName: p.name,
            productSku: p.sku,
            type: p.stock === 0 ? 'out_of_stock' : 'low_stock',
            currentStock: p.stock,
            threshold: p.minStock,
            severity: p.stock === 0 ? 'critical' : 'medium',
            message: p.stock === 0 ? 'Producto agotado' : 'Stock bajo',
            isActive: true,
            createdAt: new Date()
          }))
        setAlerts(localAlerts)
      }

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [productPage, productSearch, selectedBranchId, supabase])

  // Efectos
  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setProductSearch(productSearchInput)
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [productSearchInput])

  useEffect(() => {
    setProductPage(1)
  }, [productSearch])

  useEffect(() => {
    if (movementType !== 'transferencia') return
    if (transferToBranchId && transferToBranchId !== selectedBranchId) return

    const fallbackDestination = branches.find((branch) => branch.id !== selectedBranchId)?.id || ''
    setTransferToBranchId(fallbackDestination)
  }, [branches, movementType, selectedBranchId, transferToBranchId])

  // Funciones utilitarias
  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
    }
  }

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'entrada': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'salida': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'ajuste': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'transferencia': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
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
    if (!selectedProduct) {
      setMovementError('Selecciona un producto.')
      return
    }

    const validationError = validateStockMovement({
      type: movementType,
      currentStock: selectedProduct.stock,
      quantity: movementQuantity,
      reason: movementReason,
      sourceBranchId: selectedBranchId,
      destinationBranchId: transferToBranchId,
    })
    if (validationError) {
      setMovementError(validationError)
      return
    }

    setMovementError('')
    setIsLoading(true)
    
    try {
      if (movementType === 'transferencia') {
        const { error: transferError } = await supabase.rpc('transfer_branch_inventory_stock', {
          p_product_id: selectedProduct.id,
          p_from_branch_id: selectedBranchId,
          p_to_branch_id: transferToBranchId,
          p_quantity: movementQuantity,
          p_reason: movementReason || null,
          p_reference_id: movementReference || null
        })

        if (transferError) throw transferError

        await fetchData()
        setIsMovementDialogOpen(false)
        setSelectedProduct(null)
        setMovementQuantity(0)
        setMovementReason('')
        setMovementReference('')
        setTransferToBranchId('')
        setMovementType('entrada')
        setMovementError('')
        return
      }

      const newStock = movementProjection.finalStock

      if (selectedBranchId) {
        const { error: branchError } = await supabase.rpc('set_branch_inventory_stock', {
          p_product_id: selectedProduct.id,
          p_branch_id: selectedBranchId,
          p_new_stock: newStock,
          p_movement_type: movementType === 'entrada' ? 'in' : movementType === 'salida' ? 'out' : 'adjustment',
          p_reason: movementReason || null,
          p_reference_id: movementReference || null
        })

        if (branchError) throw branchError
      } else {
        const { error: rpcError } = await supabase.rpc('update_product_stock', {
          product_id: selectedProduct.id,
          quantity_change: movementProjection.delta,
          movement_type: movementType === 'entrada' ? 'entry' : movementType === 'salida' ? 'exit' : 'adjustment',
          reason: movementReason,
          notes: movementReason
        })

        if (rpcError) {
          throw new Error(rpcError.message || 'No se pudo registrar el movimiento de stock.')
        }
      }

      await fetchData() // Recargar datos

      // Resetear formulario
      setIsMovementDialogOpen(false)
      setSelectedProduct(null)
      setMovementQuantity(0)
      setMovementReason('')
      setMovementReference('')
      setTransferToBranchId('')
      setMovementType('entrada')
      setMovementError('')

    } catch (error) {
      console.error('Error creating movement:', error)
      setMovementError(error instanceof Error ? error.message : 'No se pudo registrar el movimiento.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMovementDialogChange = (open: boolean) => {
    setIsMovementDialogOpen(open)
    if (open) {
      setMovementError('')
      return
    }

    setSelectedProduct(null)
    setMovementQuantity(0)
    setMovementReason('')
    setMovementReference('')
    setTransferToBranchId('')
    setMovementType('entrada')
    setMovementError('')
  }

  const acknowledgeAlert = async (alertId: string) => {
    if (alertId.startsWith('local-')) {
       // Alerta local, solo ocultar de la vista actual
       setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isActive: false } : a))
       return
    }

    try {
      const { error } = await supabase
        .from('product_alerts')
        .update({ is_resolved: true })
        .eq('id', alertId)
      
      if (error) throw error
      
      // Actualizar estado local
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
    } catch (error) {
      console.error('Error acknowledging alert:', error)
    }
  }

  const toLocalDateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const filteredMovements = movements.filter(movement => {
    if (filterType !== 'all' && movement.type !== filterType) return false
    if (filterDate && toLocalDateKey(movement.timestamp) !== filterDate) return false
    return true
  })

  const activeAlerts = alerts.filter(alert => alert.isActive)
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical')
  const hasPreviousProductPage = productPage > 1
  const hasNextProductPage = productPage * PRODUCT_PAGE_SIZE < productTotalCount

  const exportFilteredMovements = () => {
    const rows = [
      ['Fecha', 'Producto', 'SKU', 'Tipo', 'Cantidad', 'Stock Anterior', 'Stock Nuevo', 'Motivo', 'Referencia'],
      ...filteredMovements.map((movement) => [
        movement.timestamp.toLocaleString(),
        movement.productName,
        movement.productSku,
        movement.type,
        String(movement.quantity),
        String(movement.previousStock),
        String(movement.newStock),
        movement.reason,
        movement.reference || ''
      ])
    ]

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `movimientos_stock_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Stock por sucursal
            </h2>
            <Badge variant="outline" className="max-w-full gap-1.5 rounded-md font-semibold border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              <span className="truncate">{selectedBranch?.name || 'Sin sucursal activa'}</span>
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Existencias, movimientos y alertas de la ubicación seleccionada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => handleMovementDialogChange(true)}
            className="h-9 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-xs font-medium shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo Movimiento
          </Button>
        </div>
      </div>

      {/* Alertas Críticas */}
      {criticalAlerts.length > 0 && (
        <Card className="border border-rose-200 bg-rose-50/60 dark:bg-rose-950/20 dark:border-rose-900/40 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-rose-900 dark:text-rose-300 flex items-center text-sm font-bold">
              <AlertTriangle className="h-4.5 w-4.5 mr-2 text-rose-500" />
              Alertas Críticas ({criticalAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {criticalAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between bg-white dark:bg-[#0d1117] p-3 rounded-xl border border-rose-100 dark:border-white/5">
                  <div className="flex items-center space-x-3">
                    <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-xs text-slate-900 dark:text-white">{alert.productName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{alert.message}</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="h-8 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-100 text-xs dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/30"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { label: 'Alertas activas', value: activeAlerts.length, icon: Bell, tone: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20' },
          { label: 'Movimientos hoy', value: movements.filter((movement) => movement.timestamp.toDateString() === new Date().toDateString()).length, icon: ArrowUpDown, tone: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20' },
          { label: 'Productos críticos', value: criticalAlerts.length, icon: AlertTriangle, tone: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/20' },
          { label: 'Unidades en Lote', value: products.reduce((sum, product) => sum + product.stock, 0), icon: Package, tone: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/20' },
        ].map(({ label, value, icon: Icon, tone, bg }) => (
          <Card key={label} className="border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117] rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
                <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">{value.toLocaleString()}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${tone}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="movements" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-gray-100 dark:bg-gray-800 p-1">
          <TabsTrigger value="movements" className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100">
            <ArrowUpDown className="h-4 w-4" />
            <span>Actividad</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100">
            <History className="h-4 w-4" />
            <span>Auditoría</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100">
            <AlertTriangle className="h-4 w-4" />
            <span>Alertas</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100">
            <BarChart3 className="h-4 w-4" />
            <span>Análisis</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Movimientos */}
        <TabsContent value="movements" className="space-y-4">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="dark:text-gray-100">Historial de Movimientos</CardTitle>
                  <CardDescription className="dark:text-gray-400">Registro detallado de todos los movimientos de stock</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100">
                      <SelectValue placeholder="Filtrar por tipo" />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="entrada">Entradas</SelectItem>
                    <SelectItem value="salida">Salidas</SelectItem>
                    <SelectItem value="ajuste">Ajustes</SelectItem>
                    <SelectItem value="transferencia">Transferencias</SelectItem>
                  </SelectContent>
                </Select>
                  <Input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-40 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                  />
                  <Button variant="outline" onClick={exportFilteredMovements} className="dark:border-gray-700 dark:text-gray-300">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredMovements.map(movement => (
                  <div key={movement.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-lg ${getMovementTypeColor(movement.type)}`}>
                          {getMovementIcon(movement.type)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium dark:text-gray-100">{movement.productName}</h4>
                            <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">{movement.productSku}</Badge>
                            <Badge className={getMovementTypeColor(movement.type)}>
                              {movement.type.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{movement.reason}</p>
                          {movement.reference && (
                            <p className="text-xs text-gray-500 dark:text-gray-500">Ref: {movement.reference}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-semibold dark:text-gray-100">
                            {movement.newStock >= movement.previousStock ? '+' : '-'}{movement.quantity}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({movement.previousStock} → {movement.newStock})
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
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
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-gray-100">Gestión de Alertas</CardTitle>
              <CardDescription className="dark:text-gray-400">Configuración y seguimiento de alertas de inventario</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.map(alert => (
                  <div key={alert.id} className={`border rounded-lg p-4 ${alert.isActive ? '' : 'opacity-50'} dark:border-gray-700`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-lg ${getAlertSeverityColor(alert.severity)}`}>
                          {alert.severity === 'critical' ? <XCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium dark:text-gray-100">{alert.productName}</h4>
                            <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">{alert.productSku}</Badge>
                            <Badge className={getAlertSeverityColor(alert.severity)}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{alert.message}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
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
                            className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Reconocer
                          </Button>
                        ) : (
                          <div className="text-xs text-gray-500 dark:text-gray-500">
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
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="dark:text-gray-100">Productos con Stock Bajo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {products.filter(p => p.stock <= p.minStock).map(product => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800">
                      <div>
                        <p className="font-medium dark:text-gray-200">{product.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{product.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-yellow-700 dark:text-yellow-400">{product.stock} / {product.minStock}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">Stock / Mínimo</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="dark:text-gray-100">Movimientos Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {movements.slice(0, 5).map(movement => (
                    <div key={movement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg dark:bg-gray-900">
                      <div className="flex items-center space-x-3">
                        <div className={`p-1 rounded ${getMovementTypeColor(movement.type)}`}>
                          {getMovementIcon(movement.type)}
                        </div>
                        <div>
                          <p className="font-medium text-sm dark:text-gray-200">{movement.productName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{movement.timestamp.toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm dark:text-gray-200">
                          {movement.newStock >= movement.previousStock ? '+' : '-'}{movement.quantity}
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
      <Dialog open={isMovementDialogOpen} onOpenChange={handleMovementDialogChange}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-none w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-0 shadow-2xl dark:border-white/10 dark:bg-[#0d1117] sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] xl:max-h-[60rem] xl:max-w-[90rem]">
          <DialogHeader className="border-b border-slate-100 px-4 py-4 text-left dark:border-white/5 sm:px-6">
            <div className="flex flex-wrap items-center gap-2.5 pr-7">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <ArrowUpDown className="h-4.5 w-4.5" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                Registrar Movimiento de Stock
              </DialogTitle>
              <Badge variant="outline" className="gap-1.5 rounded-md font-semibold border-slate-200 text-slate-700 dark:border-white/10 dark:text-slate-300">
                <Building2 className="h-3.5 w-3.5 text-blue-500" />
                {selectedBranch?.name || 'Inventario general'}
              </Badge>
            </div>
            <DialogDescription className="pl-0 text-xs text-slate-500 dark:text-slate-400 sm:pl-[46px]">
              Registra una operación trazable en el inventario de la sucursal activa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-4 py-5 sm:px-6 lg:grid-cols-[minmax(30rem,1.1fr)_minmax(26rem,0.9fr)]">
            <div className="min-w-0 space-y-6 lg:border-r lg:border-slate-100 lg:pr-6 dark:lg:border-white/5">
            <section className="space-y-3" aria-labelledby="movement-product-label">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label id="movement-product-label" className="text-xs font-bold text-slate-800 dark:text-slate-200">1. Selecciona el producto</Label>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Busca por nombre o código y confirma el stock actual.</p>
                </div>
                {isLoading && <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-blue-500" aria-label="Cargando productos" />}
              </div>
              <div className="grid gap-2 xl:grid-cols-[minmax(14rem,0.8fr)_minmax(18rem,1.2fr)]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={productSearchInput}
                    onChange={(e) => setProductSearchInput(e.target.value)}
                    placeholder="Buscar por nombre o SKU..."
                    className="h-11 rounded-md border-slate-200 pl-9 text-xs dark:border-white/10 dark:bg-[#161b22] dark:text-white"
                  />
                </div>
                <Select
                  value={selectedProduct?.id || ''}
                  onValueChange={(value) => {
                    setSelectedProduct(products.find((product) => product.id === value) || null)
                    setMovementError('')
                  }}
                >
                  <SelectTrigger className="h-11 rounded-md border-slate-200 text-xs dark:border-white/10 dark:bg-[#161b22] dark:text-white">
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id} className="text-xs">
                        {product.name} · {product.sku || 'Sin SKU'} · Stock: {product.stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProduct && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-blue-200 bg-blue-50/70 px-3 py-2.5 dark:border-blue-500/20 dark:bg-blue-500/5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{selectedProduct.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">SKU: {selectedProduct.sku || 'Sin SKU'} · {selectedProduct.category || 'Sin categoría'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Disponible</p>
                    <p className="text-base font-bold tabular-nums text-blue-700 dark:text-blue-300">{selectedProduct.stock}</p>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 text-[11px] text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Mostrando {products.length} de {productTotalCount} productos
                </span>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setProductPage((current) => Math.max(1, current - 1))}
                    disabled={!hasPreviousProductPage || isLoading}
                    className="h-7 text-xs rounded-lg border-slate-200 dark:border-white/10 dark:text-slate-300"
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setProductPage((current) => current + 1)}
                    disabled={!hasNextProductPage || isLoading}
                    className="h-7 text-xs rounded-lg border-slate-200 dark:border-white/10 dark:text-slate-300"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="movement-type-label">
              <div>
                <Label id="movement-type-label" className="text-xs font-bold text-slate-800 dark:text-slate-200">2. Elige la operación</Label>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">La operación define cómo cambiará la existencia.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MOVEMENT_TYPE_OPTIONS.map(({ value, label, description, icon: Icon, activeClass }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={movementType === value ? 'default' : 'outline'}
                    className={`h-auto min-h-14 justify-start gap-3 rounded-md border px-3 py-2.5 text-left shadow-none transition-colors ${movementType === value ? activeClass : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5'}`}
                    onClick={() => {
                      setMovementType(value)
                      setMovementQuantity(0)
                      setMovementError('')
                    }}
                    aria-pressed={movementType === value}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">{label}</span>
                      <span className="mt-0.5 block text-[10px] font-normal opacity-75">{description}</span>
                    </span>
                  </Button>
                ))}
              </div>
            </section>

            </div>

            <aside className="min-w-0 space-y-5">

            <div>
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">3. Completa el detalle</Label>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Indica la cantidad y deja un motivo para la trazabilidad.</p>
            </div>

            {movementType === 'transferencia' && (
              <section className="grid grid-cols-1 items-end gap-3 rounded-md border border-slate-200/80 bg-slate-50/50 p-4 md:grid-cols-[1fr_auto_1fr] dark:border-white/10 dark:bg-white/[0.02]">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase">Origen</Label>
                  <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 dark:border-white/10 dark:bg-[#161b22] dark:text-white">
                    <Building2 className="h-3.5 w-3.5 text-blue-500" />
                    {selectedBranch?.name || 'Selecciona una sucursal activa'}
                  </div>
                </div>
                <ArrowRight className="mb-2 hidden h-4 w-4 text-slate-400 md:block" />
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase">Destino</Label>
                  <Select value={transferToBranchId} onValueChange={(value) => {
                    setTransferToBranchId(value)
                    setMovementError('')
                  }}>
                    <SelectTrigger className="h-10 rounded-md border-slate-200 text-xs dark:border-white/10 dark:bg-[#161b22] dark:text-white">
                      <SelectValue placeholder="Seleccionar destino..." />
                    </SelectTrigger>
                    <SelectContent>
                      {branches
                        .filter((branch) => branch.id !== selectedBranchId)
                        .map((branch) => (
                          <SelectItem key={branch.id} value={branch.id} className="text-xs">
                            {branch.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {branches.length < 2 && (
                  <p className="text-xs font-medium text-amber-600 md:col-span-3 dark:text-amber-400">
                    Necesitas al menos dos sucursales activas para registrar una transferencia.
                  </p>
                )}
              </section>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="movement-quantity" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {movementType === 'ajuste' ? 'Stock final contado' : 'Cantidad'} <span className="text-rose-500">*</span>
                </Label>
                <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] overflow-hidden rounded-md border border-slate-200 dark:border-white/10">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-none border-r border-slate-200 dark:border-white/10"
                    onClick={() => {
                      setMovementQuantity((current) => Math.max(0, current - 1))
                      setMovementError('')
                    }}
                    disabled={movementQuantity <= 0}
                    aria-label="Restar una unidad"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="movement-quantity"
                    type="number"
                    min={movementType === 'ajuste' ? 0 : 1}
                    max={movementType === 'salida' || movementType === 'transferencia' ? selectedProduct?.stock : undefined}
                    value={movementQuantity}
                    onChange={(e) => {
                      setMovementQuantity(Math.max(0, Number.parseInt(e.target.value, 10) || 0))
                      setMovementError('')
                    }}
                    placeholder="0"
                    className="h-10 rounded-none border-0 text-center text-sm font-bold tabular-nums shadow-none focus-visible:ring-0 dark:bg-[#161b22] dark:text-white"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-none border-l border-slate-200 dark:border-white/10"
                    onClick={() => {
                      setMovementQuantity((current) => current + 1)
                      setMovementError('')
                    }}
                    disabled={Boolean(
                      selectedProduct &&
                      (movementType === 'salida' || movementType === 'transferencia') &&
                      movementQuantity >= selectedProduct.stock
                    )}
                    aria-label="Sumar una unidad"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {movementType === 'ajuste'
                    ? 'Ingresa la cantidad resultante del conteo físico.'
                    : `Disponible: ${selectedProduct?.stock ?? 0} unidades.`}
                </p>
                {movementType !== 'ajuste' && (
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 5, 10].map((quantity) => (
                      <Button
                        key={quantity}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-md border-slate-200 px-2 text-[11px] font-semibold dark:border-white/10"
                        onClick={() => {
                          setMovementQuantity(quantity)
                          setMovementError('')
                        }}
                        disabled={Boolean(
                          selectedProduct &&
                          (movementType === 'salida' || movementType === 'transferencia') &&
                          quantity > selectedProduct.stock
                        )}
                      >
                        Usar {quantity}
                      </Button>
                    ))}
                    {(movementType === 'salida' || movementType === 'transferencia') && selectedProduct && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-md border-slate-200 px-2 text-[11px] font-semibold text-rose-600 dark:border-white/10 dark:text-rose-400"
                        onClick={() => {
                          setMovementQuantity(selectedProduct.stock)
                          setMovementError('')
                        }}
                        disabled={selectedProduct.stock <= 0}
                      >
                        Todo ({selectedProduct.stock})
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="movement-reference" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Referencia <span className="font-normal text-slate-400">(opcional)</span></Label>
                <Input
                  id="movement-reference"
                  value={movementReference}
                  onChange={(e) => setMovementReference(e.target.value)}
                  placeholder="Factura, orden o comprobante"
                  className="h-10 rounded-md border-slate-200 text-xs dark:border-white/10 dark:bg-[#161b22] dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="movement-reason" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Motivo <span className="text-rose-500">*</span></Label>
                <span className="text-[10px] text-slate-400">Quedará registrado en el historial</span>
              </div>
              <Textarea
                id="movement-reason"
                value={movementReason}
                onChange={(e) => {
                  setMovementReason(e.target.value)
                  setMovementError('')
                }}
                placeholder="Describe brevemente el motivo del movimiento..."
                rows={2}
                className="resize-none rounded-md border-slate-200 text-xs dark:border-white/10 dark:bg-[#161b22] dark:text-white"
              />
              <div className="flex flex-wrap gap-1.5" aria-label="Motivos frecuentes">
                {MOVEMENT_REASON_SUGGESTIONS[movementType].map((reason) => (
                  <Button
                    key={reason}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-md border-slate-200 px-2 text-[10px] font-medium dark:border-white/10"
                    onClick={() => {
                      setMovementReason(reason)
                      setMovementError('')
                    }}
                  >
                    {reason}
                  </Button>
                ))}
              </div>
            </div>

            {selectedProduct ? (
              <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.02]" aria-labelledby="movement-summary-title">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 id="movement-summary-title" className="text-xs font-bold text-slate-800 dark:text-slate-200">Resultado proyectado</h4>
                  <Badge variant="outline" className="rounded-md text-[10px]">
                    <SelectedMovementIcon className="mr-1 h-3 w-3" />
                    {selectedMovementOption.label}
                  </Badge>
                </div>
                <p className="mb-4 break-words text-xs font-bold text-slate-900 dark:text-white">{selectedProduct.name} <span className="font-normal text-slate-400">({selectedProduct.sku || 'Sin SKU'})</span></p>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2">
                    <p className="text-slate-500 dark:text-slate-400">Stock actual</p>
                    <p className="font-bold tabular-nums text-slate-900 dark:text-white">{selectedProduct.stock}</p>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2">
                    <p className="text-slate-500 dark:text-slate-400">Cambio</p>
                    <p className="font-bold tabular-nums text-blue-600 dark:text-blue-400">
                      {movementProjection.delta > 0 ? '+' : ''}{movementProjection.delta}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-slate-500 dark:text-slate-400 font-semibold">Stock final</p>
                    <p className={`text-lg font-bold tabular-nums ${movementProjection.finalStock < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                      {movementProjection.finalStock}
                    </p>
                  </div>
                </div>
                {movementType === 'transferencia' && destinationBranch && (
                  <p className="mt-3 border-t border-slate-200/60 dark:border-white/5 pt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Se descontarán <span className="font-bold text-slate-900 dark:text-white">{movementQuantity}</span> unidades de <span className="font-bold">{selectedBranch?.name}</span> y se agregarán a <span className="font-bold">{destinationBranch.name}</span>.
                  </p>
                )}
              </section>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-white/10">
                <Package className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 text-xs font-bold text-slate-900 dark:text-white">Selecciona un producto</p>
                <p className="mt-1 text-[11px] text-slate-400">Aquí verás la proyección del stock antes y después del movimiento.</p>
              </div>
            )}

            {movementError && (
              <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                {movementError}
              </p>
            )}
            </aside>
          </div>

          <DialogFooter className="flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-white/5 dark:bg-[#161b22] sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className={`min-w-0 text-left text-[11px] ${movementValidationError ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`} aria-live="polite">
              {movementValidationError ? `Falta completar: ${movementValidationError}` : 'Movimiento listo para registrar.'}
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button variant="outline" onClick={() => handleMovementDialogChange(false)} className="h-9 flex-1 rounded-md border-slate-200 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300 sm:flex-none">
                Cancelar
              </Button>
              <Button
                onClick={handleCreateMovement}
                disabled={!canSubmitMovement}
                className="h-9 flex-1 rounded-md bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 sm:flex-none"
              >
                {isLoading ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {isLoading
                  ? 'Registrando...'
                  : movementType === 'transferencia'
                    ? 'Transferir stock'
                    : movementType === 'ajuste'
                      ? 'Guardar ajuste'
                      : movementType === 'entrada'
                        ? 'Registrar entrada'
                        : 'Registrar salida'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default StockControl
