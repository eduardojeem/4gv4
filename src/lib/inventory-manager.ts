interface Product {
  id: string
  name: string
  sku: string
  price: number
  cost?: number
  stock: number
  category: string
  description: string
  featured: boolean
  minStock?: number
  maxStock?: number
  lastUpdated?: string
}

interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  stock: number
}

interface StockMovement {
  id: string
  productId: string
  type: 'sale' | 'restock' | 'adjustment' | 'return'
  quantity: number
  previousStock: number
  newStock: number
  timestamp: string
  reference?: string
  notes?: string
}

interface InventoryAlert {
  id: string
  productId: string
  type: 'low_stock' | 'out_of_stock' | 'overstocked'
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: string
  acknowledged: boolean
}

// Clase principal para gestión de inventario
export class InventoryManager {
  private products: Map<string, Product> = new Map()
  private stockMovements: StockMovement[] = []
  private alerts: InventoryAlert[] = []
  private listeners: Set<(products: Product[]) => void> = new Set()
  private alertListeners: Set<(alerts: InventoryAlert[]) => void> = new Set()

  constructor(initialProducts: Product[] = []) {
    this.initializeProducts(initialProducts)
  }

  // Inicializar productos
  private initializeProducts(products: Product[]) {
    products.forEach(product => {
      this.products.set(product.id, {
        ...product,
        minStock: product.minStock || 5,
        maxStock: product.maxStock || 100,
        lastUpdated: new Date().toISOString()
      })
    })
    this.checkAllStockLevels()
  }

  // Suscribirse a cambios de inventario
  subscribe(callback: (products: Product[]) => void) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  // Suscribirse a alertas
  subscribeToAlerts(callback: (alerts: InventoryAlert[]) => void) {
    this.alertListeners.add(callback)
    return () => this.alertListeners.delete(callback)
  }

  // Notificar cambios
  private notifyListeners() {
    const products = Array.from(this.products.values())
    this.listeners.forEach(callback => callback(products))
  }

  private notifyAlertListeners() {
    this.alertListeners.forEach(callback => callback(this.alerts))
  }

  // Obtener todos los productos
  getProducts(): Product[] {
    return Array.from(this.products.values())
  }

  // Obtener producto por ID
  getProduct(id: string): Product | undefined {
    return this.products.get(id)
  }

  // Verificar disponibilidad de stock
  checkAvailability(productId: string, requestedQuantity: number): {
    available: boolean
    maxAvailable: number
    message?: string
  } {
    const product = this.products.get(productId)
    
    if (!product) {
      return {
        available: false,
        maxAvailable: 0,
        message: 'Producto no encontrado'
      }
    }

    if (product.stock <= 0) {
      return {
        available: false,
        maxAvailable: 0,
        message: 'Producto agotado'
      }
    }

    if (requestedQuantity > product.stock) {
      return {
        available: false,
        maxAvailable: product.stock,
        message: `Solo hay ${product.stock} unidades disponibles`
      }
    }

    return {
      available: true,
      maxAvailable: product.stock
    }
  }

  // Procesar venta (reducir stock)
  processSale(cartItems: CartItem[], saleReference?: string): {
    success: boolean
    errors: string[]
    movements: StockMovement[]
  } {
    const errors: string[] = []
    const movements: StockMovement[] = []

    // Verificar disponibilidad de todos los productos primero
    for (const item of cartItems) {
      const availability = this.checkAvailability(item.id, item.quantity)
      if (!availability.available) {
        errors.push(`${item.name}: ${availability.message}`)
      }
    }

    if (errors.length > 0) {
      return { success: false, errors, movements: [] }
    }

    // Procesar la venta
    for (const item of cartItems) {
      const product = this.products.get(item.id)
      if (product) {
        const movement = this.updateStock(
          item.id,
          -item.quantity,
          'sale',
          saleReference,
          `Venta de ${item.quantity} unidades`
        )
        if (movement) {
          movements.push(movement)
        }
      }
    }

    this.notifyListeners()
    return { success: true, errors: [], movements }
  }

  // Actualizar stock de un producto
  updateStock(
    productId: string,
    quantityChange: number,
    type: StockMovement['type'] = 'adjustment',
    reference?: string,
    notes?: string
  ): StockMovement | null {
    const product = this.products.get(productId)
    if (!product) return null

    const previousStock = product.stock
    const newStock = Math.max(0, previousStock + quantityChange)

    // Crear movimiento de stock
    const movement: StockMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId,
      type,
      quantity: quantityChange,
      previousStock,
      newStock,
      timestamp: new Date().toISOString(),
      reference,
      notes
    }

    // Actualizar producto
    this.products.set(productId, {
      ...product,
      stock: newStock,
      lastUpdated: new Date().toISOString()
    })

    // Guardar movimiento
    this.stockMovements.push(movement)

    // Verificar alertas
    this.checkStockLevel(productId)

    return movement
  }

  // Verificar nivel de stock de un producto
  private checkStockLevel(productId: string) {
    const product = this.products.get(productId)
    if (!product) return

    // Remover alertas anteriores del producto
    this.alerts = this.alerts.filter(alert => 
      alert.productId !== productId || alert.acknowledged
    )

    let newAlert: InventoryAlert | null = null

    if (product.stock === 0) {
      newAlert = {
        id: `alert_${Date.now()}_${productId}`,
        productId,
        type: 'out_of_stock',
        message: `${product.name} está agotado`,
        severity: 'critical',
        timestamp: new Date().toISOString(),
        acknowledged: false
      }
    } else if (product.stock <= (product.minStock || 5)) {
      newAlert = {
        id: `alert_${Date.now()}_${productId}`,
        productId,
        type: 'low_stock',
        message: `${product.name} tiene stock bajo (${product.stock} unidades)`,
        severity: product.stock <= 2 ? 'high' : 'medium',
        timestamp: new Date().toISOString(),
        acknowledged: false
      }
    } else if (product.maxStock && product.stock > product.maxStock) {
      newAlert = {
        id: `alert_${Date.now()}_${productId}`,
        productId,
        type: 'overstocked',
        message: `${product.name} tiene exceso de stock (${product.stock} unidades)`,
        severity: 'low',
        timestamp: new Date().toISOString(),
        acknowledged: false
      }
    }

    if (newAlert) {
      this.alerts.push(newAlert)
      this.notifyAlertListeners()
    }
  }

  // Upsert de producto (crear o actualizar información sin movimientos de stock)
  upsertProduct(product: Product) {
    const existing = this.products.get(product.id)
    const merged: Product = {
      ...existing,
      ...product,
      lastUpdated: new Date().toISOString()
    } as Product
    this.products.set(product.id, merged)
    this.checkStockLevel(product.id)
    this.notifyListeners()
  }

  // Actualizar información de producto parcialmente (precio, descripción, stock directo)
  updateProductInfo(productId: string, fields: Partial<Product>): boolean {
    const existing = this.products.get(productId)
    if (!existing) return false

    const updated: Product = {
      ...existing,
      ...fields,
      lastUpdated: new Date().toISOString()
    }

    this.products.set(productId, updated)
    // Si el stock cambió, verificar alertas
    if (typeof fields.stock === 'number') {
      this.checkStockLevel(productId)
    }
    this.notifyListeners()
    return true
  }

  // Remover producto del inventario
  removeProduct(productId: string): boolean {
    const existed = this.products.delete(productId)
    if (existed) {
      // Limpiar alertas relacionadas
      this.alerts = this.alerts.filter(a => a.productId !== productId)
      this.notifyListeners()
      this.notifyAlertListeners()
    }
    return existed
  }

  // Verificar todos los niveles de stock
  private checkAllStockLevels() {
    this.products.forEach((_, productId) => {
      this.checkStockLevel(productId)
    })
  }

  // Obtener alertas activas
  getActiveAlerts(): InventoryAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged)
  }

  // Obtener alertas por severidad
  getAlertsBySeverity(severity: InventoryAlert['severity']): InventoryAlert[] {
    return this.alerts.filter(alert => 
      alert.severity === severity && !alert.acknowledged
    )
  }

  // Marcar alerta como reconocida
  acknowledgeAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      this.notifyAlertListeners()
    }
  }

  // Obtener movimientos de stock
  getStockMovements(productId?: string, limit?: number): StockMovement[] {
    let movements = this.stockMovements
    
    if (productId) {
      movements = movements.filter(m => m.productId === productId)
    }
    
    movements = movements.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    
    if (limit) {
      movements = movements.slice(0, limit)
    }
    
    return movements
  }

  // Reabastecer stock
  restockProduct(productId: string, quantity: number, reference?: string): boolean {
    const movement = this.updateStock(
      productId,
      quantity,
      'restock',
      reference,
      `Reabastecimiento de ${quantity} unidades`
    )
    
    if (movement) {
      this.notifyListeners()
      return true
    }
    
    return false
  }

  // Ajustar stock manualmente
  adjustStock(productId: string, newStock: number, reason?: string): boolean {
    const product = this.products.get(productId)
    if (!product) return false

    const quantityChange = newStock - product.stock
    const movement = this.updateStock(
      productId,
      quantityChange,
      'adjustment',
      undefined,
      reason || 'Ajuste manual de inventario'
    )
    
    if (movement) {
      this.notifyListeners()
      return true
    }
    
    return false
  }

  // Obtener estadísticas de inventario
  getInventoryStats() {
    const products = this.getProducts()
    const totalProducts = products.length
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0)
    const lowStockProducts = products.filter(p => p.stock <= (p.minStock || 5))
    const outOfStockProducts = products.filter(p => p.stock === 0)
    const activeAlerts = this.getActiveAlerts()

    return {
      totalProducts,
      totalValue,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      alertCount: activeAlerts.length,
      criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
      averageStock: totalProducts > 0 ? products.reduce((sum, p) => sum + p.stock, 0) / totalProducts : 0
    }
  }

  // Exportar datos para respaldo
  exportData() {
    return {
      products: Array.from(this.products.values()),
      movements: this.stockMovements,
      alerts: this.alerts,
      timestamp: new Date().toISOString()
    }
  }

  // Importar datos desde respaldo
  importData(data: any) {
    if (data.products) {
      this.initializeProducts(data.products)
    }
    if (data.movements) {
      this.stockMovements = data.movements
    }
    if (data.alerts) {
      this.alerts = data.alerts
    }
    this.notifyListeners()
    this.notifyAlertListeners()
  }
}

// Instancia singleton del gestor de inventario
let inventoryManager: InventoryManager | null = null

export const getInventoryManager = (initialProducts?: Product[]): InventoryManager => {
  if (!inventoryManager) {
    inventoryManager = new InventoryManager(initialProducts)
  }
  return inventoryManager
}

// Hook personalizado para React
export const useInventory = (initialProducts?: Product[]) => {
  const manager = getInventoryManager(initialProducts)
  return manager
}

// Utilidades adicionales
export const formatStockStatus = (stock: number, minStock: number = 5): {
  status: 'ok' | 'low' | 'critical' | 'out'
  color: string
  message: string
} => {
  if (stock === 0) {
    return {
      status: 'out',
      color: 'red',
      message: 'Agotado'
    }
  } else if (stock <= 2) {
    return {
      status: 'critical',
      color: 'red',
      message: 'Stock crítico'
    }
  } else if (stock <= minStock) {
    return {
      status: 'low',
      color: 'orange',
      message: 'Stock bajo'
    }
  } else {
    return {
      status: 'ok',
      color: 'green',
      message: 'Stock disponible'
    }
  }
}

export type { Product, CartItem, StockMovement, InventoryAlert }