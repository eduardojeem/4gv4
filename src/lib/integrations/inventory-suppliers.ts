import { createClient } from '@supabase/supabase-js'
import React from 'react'

// Interfaces para proveedores de inventario
export interface SupplierProduct {
  id: string
  supplierId: string
  supplierSKU: string
  internalSKU: string
  name: string
  description?: string
  category: string
  unitPrice: number
  currency: string
  minimumOrderQuantity: number
  leadTimeDays: number
  availability: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued'
  lastUpdated: Date
  specifications?: Record<string, any>
  images?: string[]
  certifications?: string[]
  externalId?: string
  syncStatus: 'pending' | 'synced' | 'error'
}

export interface Supplier {
  id: string
  name: string
  code: string
  type: 'manufacturer' | 'distributor' | 'wholesaler' | 'dropshipper'
  status: 'active' | 'inactive' | 'suspended'
  contactInfo: {
    email: string
    phone: string
    website?: string
    address: {
      street: string
      city: string
      state: string
      postalCode: string
      country: string
    }
  }
  paymentTerms: {
    method: 'net_30' | 'net_60' | 'cod' | 'prepaid' | 'credit_card'
    creditLimit?: number
    discountTerms?: string
  }
  shippingInfo: {
    methods: string[]
    freeShippingThreshold?: number
    averageDeliveryDays: number
    shipsFrom: string[]
  }
  performance: {
    rating: number
    onTimeDeliveryRate: number
    qualityRating: number
    responseTime: number
    totalOrders: number
    totalValue: number
  }
  integration: {
    type: 'api' | 'edi' | 'email' | 'manual'
    apiEndpoint?: string
    credentials?: Record<string, string>
    lastSyncAt?: Date
    syncFrequency?: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface PurchaseOrder {
  id: string
  orderNumber: string
  supplierId: string
  supplierName: string
  status: 'draft' | 'sent' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  orderDate: Date
  expectedDeliveryDate?: Date
  actualDeliveryDate?: Date
  items: PurchaseOrderItem[]
  subtotal: number
  taxAmount: number
  shippingCost: number
  totalAmount: number
  currency: string
  notes?: string
  trackingNumbers?: string[]
  externalOrderId?: string
  syncStatus: 'pending' | 'synced' | 'error'
  createdAt: Date
  updatedAt: Date
}

export interface PurchaseOrderItem {
  id: string
  productId: string
  supplierSKU: string
  internalSKU: string
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
  receivedQuantity?: number
  status: 'pending' | 'confirmed' | 'shipped' | 'received' | 'cancelled'
}

export interface InventoryReorder {
  id: string
  productId: string
  currentStock: number
  reorderPoint: number
  reorderQuantity: number
  preferredSupplierId: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  estimatedCost: number
  status: 'pending' | 'ordered' | 'completed' | 'cancelled'
  createdAt: Date
  processedAt?: Date
}

export interface SupplierQuote {
  id: string
  supplierId: string
  productId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  leadTimeDays: number
  validUntil: Date
  terms?: string
  notes?: string
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  createdAt: Date
}

export interface SupplierConfig {
  supplierId: string
  provider: 'api' | 'edi' | 'email' | 'csv'
  isActive: boolean
  credentials: {
    apiKey?: string
    username?: string
    password?: string
    endpoint?: string
    ftpHost?: string
    emailAddress?: string
  }
  settings: {
    autoSync: boolean
    syncInterval: number // en minutos
    autoReorder: boolean
    reorderThreshold: number
    maxOrderValue: number
    preferredCurrency: string
  }
  mapping: {
    skuField: string
    nameField: string
    priceField: string
    stockField: string
    categoryField?: string
  }
  lastSyncAt?: Date
  syncErrors?: string[]
}

export interface SyncResult {
  success: boolean
  productsProcessed: number
  productsUpdated: number
  productsAdded: number
  productsSkipped: number
  ordersProcessed: number
  ordersUpdated: number
  errors: string[]
  duration: number
  timestamp: Date
}

// Clase base para integraciones de proveedores
export abstract class SupplierIntegration {
  protected config: SupplierConfig
  protected supplier: Supplier
  protected supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  constructor(config: SupplierConfig, supplier: Supplier) {
    this.config = config
    this.supplier = supplier
  }

  // Métodos abstractos
  abstract authenticate(): Promise<boolean>
  abstract syncProducts(): Promise<SyncResult>
  abstract syncInventory(): Promise<SyncResult>
  abstract createPurchaseOrder(order: Omit<PurchaseOrder, 'id' | 'externalOrderId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<PurchaseOrder>
  abstract updateOrderStatus(orderId: string): Promise<PurchaseOrder>
  abstract getQuote(productId: string, quantity: number): Promise<SupplierQuote>
  abstract checkProductAvailability(sku: string): Promise<{ available: boolean; quantity: number; price: number }>

  // Métodos comunes
  async saveProduct(product: SupplierProduct): Promise<void> {
    const { error } = await this.supabase
      .from('supplier_products')
      .upsert(product)

    if (error) throw error
  }

  async savePurchaseOrder(order: PurchaseOrder): Promise<void> {
    const { error } = await this.supabase
      .from('purchase_orders')
      .upsert(order)

    if (error) throw error
  }

  async getProducts(): Promise<SupplierProduct[]> {
    const { data, error } = await this.supabase
      .from('supplier_products')
      .select('*')
      .eq('supplierId', this.supplier.id)
      .order('name')

    if (error) throw error
    return data || []
  }

  async updateSyncStatus(recordType: string, recordId: string, status: 'pending' | 'synced' | 'error', error?: string): Promise<void> {
    const table = recordType === 'product' ? 'supplier_products' : 'purchase_orders'
    const updates: any = {
      syncStatus: status,
      updatedAt: new Date()
    }

    if (error && status === 'error') {
      updates.syncError = error
    }

    await this.supabase
      .from(table)
      .update(updates)
      .eq('id', recordId)
  }

  protected mapProductData(rawData: any): SupplierProduct {
    const mapping = this.config.mapping
    
    return {
      id: `${this.supplier.id}_${rawData[mapping.skuField]}`,
      supplierId: this.supplier.id,
      supplierSKU: rawData[mapping.skuField],
      internalSKU: rawData[mapping.skuField], // Mapear según necesidades
      name: rawData[mapping.nameField],
      description: rawData.description || '',
      category: rawData[mapping.categoryField] || 'General',
      unitPrice: parseFloat(rawData[mapping.priceField]) || 0,
      currency: this.config.settings.preferredCurrency,
      minimumOrderQuantity: rawData.moq || 1,
      leadTimeDays: rawData.leadTime || this.supplier.shippingInfo.averageDeliveryDays,
      availability: this.mapAvailability(rawData[mapping.stockField]),
      lastUpdated: new Date(),
      specifications: rawData.specifications || {},
      images: rawData.images || [],
      syncStatus: 'synced'
    }
  }

  private mapAvailability(stock: any): SupplierProduct['availability'] {
    const stockLevel = parseInt(stock) || 0
    
    if (stockLevel === 0) return 'out_of_stock'
    if (stockLevel < 10) return 'low_stock'
    return 'in_stock'
  }
}

// Implementación para API REST
export class APISupplierIntegration extends SupplierIntegration {
  private baseUrl: string

  constructor(config: SupplierConfig, supplier: Supplier) {
    super(config, supplier)
    this.baseUrl = config.credentials.endpoint || ''
  }

  async authenticate(): Promise<boolean> {
    try {
      // Simular autenticación con API
      const response = await fetch(`${this.baseUrl}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: this.config.credentials.apiKey,
          username: this.config.credentials.username
        })
      })

      // Simular respuesta exitosa
      await new Promise(resolve => setTimeout(resolve, 500))
      return true

    } catch (error) {
      console.error('API authentication failed:', error)
      return false
    }
  }

  async syncProducts(): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      productsProcessed: 0,
      productsUpdated: 0,
      productsAdded: 0,
      productsSkipped: 0,
      ordersProcessed: 0,
      ordersUpdated: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    }

    try {
      // Simular obtención de productos desde API
      const mockProducts = [
        {
          sku: 'SUPP001',
          name: 'Producto Proveedor 1',
          description: 'Descripción del producto 1',
          price: 25.99,
          stock: 100,
          category: 'Electrónicos',
          moq: 5,
          leadTime: 7
        },
        {
          sku: 'SUPP002',
          name: 'Producto Proveedor 2',
          description: 'Descripción del producto 2',
          price: 45.50,
          stock: 50,
          category: 'Accesorios',
          moq: 10,
          leadTime: 14
        }
      ]

      for (const rawProduct of mockProducts) {
        try {
          const product = this.mapProductData(rawProduct)
          await this.saveProduct(product)
          result.productsAdded++
        } catch (error) {
          result.errors.push(`Error processing product ${rawProduct.sku}: ${error}`)
        }
        result.productsProcessed++
      }

    } catch (error) {
      result.success = false
      result.errors.push(`Product sync failed: ${error}`)
    }

    result.duration = Date.now() - startTime
    return result
  }

  async syncInventory(): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      productsProcessed: 0,
      productsUpdated: 0,
      productsAdded: 0,
      productsSkipped: 0,
      ordersProcessed: 0,
      ordersUpdated: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    }

    try {
      // Simular actualización de inventario
      const products = await this.getProducts()
      
      for (const product of products) {
        try {
          // Simular obtención de stock actualizado
          const updatedStock = Math.floor(Math.random() * 200)
          const availability = updatedStock === 0 ? 'out_of_stock' : 
                             updatedStock < 10 ? 'low_stock' : 'in_stock'

          await this.supabase
            .from('supplier_products')
            .update({
              availability,
              lastUpdated: new Date(),
              syncStatus: 'synced'
            })
            .eq('id', product.id)

          result.productsUpdated++
        } catch (error) {
          result.errors.push(`Error updating product ${product.supplierSKU}: ${error}`)
        }
        result.productsProcessed++
      }

    } catch (error) {
      result.success = false
      result.errors.push(`Inventory sync failed: ${error}`)
    }

    result.duration = Date.now() - startTime
    return result
  }

  async createPurchaseOrder(order: Omit<PurchaseOrder, 'id' | 'externalOrderId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<PurchaseOrder> {
    try {
      // Simular creación de orden en API del proveedor
      await new Promise(resolve => setTimeout(resolve, 1000))

      const newOrder: PurchaseOrder = {
        ...order,
        id: `po_${Date.now()}`,
        externalOrderId: `EXT_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        syncStatus: 'synced',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await this.savePurchaseOrder(newOrder)
      return newOrder

    } catch (error) {
      throw new Error(`Error creating purchase order: ${error}`)
    }
  }

  async updateOrderStatus(orderId: string): Promise<PurchaseOrder> {
    try {
      // Simular consulta de estado en API del proveedor
      await new Promise(resolve => setTimeout(resolve, 300))

      const { data, error } = await this.supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (error) throw error

      // Simular actualización de estado
      const possibleStatuses: PurchaseOrder['status'][] = ['confirmed', 'shipped', 'delivered']
      const newStatus = possibleStatuses[Math.floor(Math.random() * possibleStatuses.length)]

      const updatedOrder = {
        ...data,
        status: newStatus,
        updatedAt: new Date(),
        syncStatus: 'synced' as const
      }

      if (newStatus === 'delivered') {
        updatedOrder.actualDeliveryDate = new Date()
      }

      await this.supabase
        .from('purchase_orders')
        .update(updatedOrder)
        .eq('id', orderId)

      return updatedOrder

    } catch (error) {
      throw new Error(`Error updating order status: ${error}`)
    }
  }

  async getQuote(productId: string, quantity: number): Promise<SupplierQuote> {
    try {
      // Simular solicitud de cotización
      await new Promise(resolve => setTimeout(resolve, 800))

      const product = await this.supabase
        .from('supplier_products')
        .select('*')
        .eq('id', productId)
        .single()

      if (!product.data) {
        throw new Error('Product not found')
      }

      const unitPrice = product.data.unitPrice * (quantity >= 100 ? 0.9 : quantity >= 50 ? 0.95 : 1)
      const totalPrice = unitPrice * quantity

      const quote: SupplierQuote = {
        id: `quote_${Date.now()}`,
        supplierId: this.supplier.id,
        productId,
        quantity,
        unitPrice,
        totalPrice,
        leadTimeDays: product.data.leadTimeDays,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        terms: quantity >= 100 ? '10% descuento por volumen' : undefined,
        status: 'pending',
        createdAt: new Date()
      }

      return quote

    } catch (error) {
      throw new Error(`Error getting quote: ${error}`)
    }
  }

  async checkProductAvailability(sku: string): Promise<{ available: boolean; quantity: number; price: number }> {
    try {
      // Simular consulta de disponibilidad
      await new Promise(resolve => setTimeout(resolve, 200))

      const { data } = await this.supabase
        .from('supplier_products')
        .select('*')
        .eq('supplierSKU', sku)
        .eq('supplierId', this.supplier.id)
        .single()

      if (!data) {
        return { available: false, quantity: 0, price: 0 }
      }

      const quantity = Math.floor(Math.random() * 200)
      return {
        available: data.availability !== 'out_of_stock',
        quantity,
        price: data.unitPrice
      }

    } catch (error) {
      return { available: false, quantity: 0, price: 0 }
    }
  }
}

// Implementación para EDI
export class EDISupplierIntegration extends SupplierIntegration {
  async authenticate(): Promise<boolean> {
    // Implementar autenticación EDI
    await new Promise(resolve => setTimeout(resolve, 1000))
    return true
  }

  async syncProducts(): Promise<SyncResult> {
    // Implementar sincronización EDI
    const result: SyncResult = {
      success: true,
      productsProcessed: 50,
      productsUpdated: 35,
      productsAdded: 15,
      productsSkipped: 0,
      ordersProcessed: 0,
      ordersUpdated: 0,
      errors: [],
      duration: 2500,
      timestamp: new Date()
    }

    await new Promise(resolve => setTimeout(resolve, 2500))
    return result
  }

  async syncInventory(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      productsProcessed: 50,
      productsUpdated: 50,
      productsAdded: 0,
      productsSkipped: 0,
      ordersProcessed: 0,
      ordersUpdated: 0,
      errors: [],
      duration: 1800,
      timestamp: new Date()
    }

    await new Promise(resolve => setTimeout(resolve, 1800))
    return result
  }

  async createPurchaseOrder(order: Omit<PurchaseOrder, 'id' | 'externalOrderId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<PurchaseOrder> {
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    return {
      ...order,
      id: `edi_po_${Date.now()}`,
      externalOrderId: `EDI_${Math.random().toString(36).substr(2, 9)}`,
      syncStatus: 'synced',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  async updateOrderStatus(orderId: string): Promise<PurchaseOrder> {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Simular actualización
    return {} as PurchaseOrder
  }

  async getQuote(productId: string, quantity: number): Promise<SupplierQuote> {
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    return {
      id: `edi_quote_${Date.now()}`,
      supplierId: this.supplier.id,
      productId,
      quantity,
      unitPrice: 20.00,
      totalPrice: 20.00 * quantity,
      leadTimeDays: 10,
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'pending',
      createdAt: new Date()
    }
  }

  async checkProductAvailability(sku: string): Promise<{ available: boolean; quantity: number; price: number }> {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return {
      available: true,
      quantity: Math.floor(Math.random() * 100),
      price: 20.00
    }
  }
}

// Factory para crear integraciones
export class SupplierIntegrationFactory {
  static create(config: SupplierConfig, supplier: Supplier): SupplierIntegration {
    switch (config.provider) {
      case 'api':
        return new APISupplierIntegration(config, supplier)
      case 'edi':
        return new EDISupplierIntegration(config, supplier)
      default:
        throw new Error(`Unsupported supplier integration: ${config.provider}`)
    }
  }
}

// Manager principal de proveedores
export class SupplierManager {
  private integrations: Map<string, SupplierIntegration> = new Map()
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async initialize(): Promise<void> {
    const { data: configs } = await this.supabase
      .from('supplier_configs')
      .select(`
        *,
        supplier:suppliers(*)
      `)
      .eq('isActive', true)

    if (configs) {
      for (const config of configs) {
        try {
          const integration = SupplierIntegrationFactory.create(config, config.supplier)
          const authenticated = await integration.authenticate()
          
          if (authenticated) {
            this.integrations.set(config.supplierId, integration)
          }
        } catch (error) {
          console.error(`Failed to initialize supplier ${config.supplierId}:`, error)
        }
      }
    }
  }

  async syncAllSuppliers(): Promise<Record<string, { products: SyncResult; inventory: SyncResult }>> {
    const results: Record<string, { products: SyncResult; inventory: SyncResult }> = {}

    for (const [supplierId, integration] of this.integrations) {
      try {
        const [productsResult, inventoryResult] = await Promise.all([
          integration.syncProducts(),
          integration.syncInventory()
        ])

        results[supplierId] = {
          products: productsResult,
          inventory: inventoryResult
        }
      } catch (error) {
        console.error(`Sync failed for supplier ${supplierId}:`, error)
      }
    }

    return results
  }

  async createAutomaticReorders(): Promise<InventoryReorder[]> {
    // Obtener productos con stock bajo
    const { data: lowStockProducts } = await this.supabase
      .from('products')
      .select(`
        *,
        supplier_products(*)
      `)
      .lt('stock_quantity', 'reorder_point')

    const reorders: InventoryReorder[] = []

    if (lowStockProducts) {
      for (const product of lowStockProducts) {
        const supplierProduct = product.supplier_products?.[0]
        if (!supplierProduct) continue

        const reorder: InventoryReorder = {
          id: `reorder_${Date.now()}_${product.id}`,
          productId: product.id,
          currentStock: product.stock_quantity,
          reorderPoint: product.reorder_point,
          reorderQuantity: product.reorder_quantity || supplierProduct.minimumOrderQuantity,
          preferredSupplierId: supplierProduct.supplierId,
          urgency: product.stock_quantity === 0 ? 'critical' : 
                   product.stock_quantity < product.reorder_point * 0.5 ? 'high' : 'medium',
          estimatedCost: supplierProduct.unitPrice * (product.reorder_quantity || supplierProduct.minimumOrderQuantity),
          status: 'pending',
          createdAt: new Date()
        }

        reorders.push(reorder)

        // Guardar en base de datos
        await this.supabase
          .from('inventory_reorders')
          .insert(reorder)
      }
    }

    return reorders
  }

  async processReorder(reorderId: string): Promise<PurchaseOrder> {
    const { data: reorder } = await this.supabase
      .from('inventory_reorders')
      .select(`
        *,
        product:products(*),
        supplier_product:supplier_products(*)
      `)
      .eq('id', reorderId)
      .single()

    if (!reorder) {
      throw new Error('Reorder not found')
    }

    const integration = this.integrations.get(reorder.preferredSupplierId)
    if (!integration) {
      throw new Error('Supplier integration not available')
    }

    // Crear orden de compra
    const purchaseOrder: Omit<PurchaseOrder, 'id' | 'externalOrderId' | 'syncStatus' | 'createdAt' | 'updatedAt'> = {
      orderNumber: `PO-${Date.now()}`,
      supplierId: reorder.preferredSupplierId,
      supplierName: reorder.supplier_product.supplier?.name || 'Unknown',
      status: 'draft',
      orderDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + reorder.supplier_product.leadTimeDays * 24 * 60 * 60 * 1000),
      items: [{
        id: `item_${Date.now()}`,
        productId: reorder.productId,
        supplierSKU: reorder.supplier_product.supplierSKU,
        internalSKU: reorder.product.sku,
        name: reorder.product.name,
        quantity: reorder.reorderQuantity,
        unitPrice: reorder.supplier_product.unitPrice,
        lineTotal: reorder.supplier_product.unitPrice * reorder.reorderQuantity,
        status: 'pending'
      }],
      subtotal: reorder.estimatedCost,
      taxAmount: reorder.estimatedCost * 0.1, // 10% tax
      shippingCost: 0,
      totalAmount: reorder.estimatedCost * 1.1,
      currency: reorder.supplier_product.currency
    }

    const createdOrder = await integration.createPurchaseOrder(purchaseOrder)

    // Actualizar estado del reorder
    await this.supabase
      .from('inventory_reorders')
      .update({
        status: 'ordered',
        processedAt: new Date()
      })
      .eq('id', reorderId)

    return createdOrder
  }

  async getSupplierPerformance(supplierId: string, startDate: Date, endDate: Date) {
    const { data: orders } = await this.supabase
      .from('purchase_orders')
      .select('*')
      .eq('supplierId', supplierId)
      .gte('orderDate', startDate.toISOString())
      .lte('orderDate', endDate.toISOString())

    if (!orders || orders.length === 0) {
      return {
        totalOrders: 0,
        totalValue: 0,
        onTimeDeliveryRate: 0,
        averageDeliveryTime: 0,
        qualityIssues: 0
      }
    }

    const totalOrders = orders.length
    const totalValue = orders.reduce((sum, order) => sum + order.totalAmount, 0)
    const deliveredOrders = orders.filter(order => order.status === 'delivered')
    const onTimeDeliveries = deliveredOrders.filter(order => 
      order.actualDeliveryDate && order.expectedDeliveryDate &&
      new Date(order.actualDeliveryDate) <= new Date(order.expectedDeliveryDate)
    )

    const onTimeDeliveryRate = deliveredOrders.length > 0 ? 
      (onTimeDeliveries.length / deliveredOrders.length) * 100 : 0

    const averageDeliveryTime = deliveredOrders.length > 0 ?
      deliveredOrders.reduce((sum, order) => {
        if (order.actualDeliveryDate && order.orderDate) {
          const deliveryTime = new Date(order.actualDeliveryDate).getTime() - new Date(order.orderDate).getTime()
          return sum + (deliveryTime / (1000 * 60 * 60 * 24)) // días
        }
        return sum
      }, 0) / deliveredOrders.length : 0

    return {
      totalOrders,
      totalValue,
      onTimeDeliveryRate,
      averageDeliveryTime,
      qualityIssues: 0 // Implementar según necesidades
    }
  }

  getAvailableSuppliers(): string[] {
    return Array.from(this.integrations.keys())
  }
}

// Hook de React para usar el sistema de proveedores
export function useSupplierSystem() {
  const [manager] = React.useState(() => new SupplierManager())
  const [loading, setLoading] = React.useState(true)
  const [suppliers, setSuppliers] = React.useState<string[]>([])

  React.useEffect(() => {
    const initializeManager = async () => {
      try {
        await manager.initialize()
        setSuppliers(manager.getAvailableSuppliers())
      } catch (error) {
        console.error('Failed to initialize supplier manager:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeManager()
  }, [manager])

  const syncAllSuppliers = React.useCallback(async () => {
    return manager.syncAllSuppliers()
  }, [manager])

  const createAutomaticReorders = React.useCallback(async () => {
    return manager.createAutomaticReorders()
  }, [manager])

  const processReorder = React.useCallback(async (reorderId: string) => {
    return manager.processReorder(reorderId)
  }, [manager])

  const getSupplierPerformance = React.useCallback(async (supplierId: string, startDate: Date, endDate: Date) => {
    return manager.getSupplierPerformance(supplierId, startDate, endDate)
  }, [manager])

  return {
    loading,
    suppliers,
    syncAllSuppliers,
    createAutomaticReorders,
    processReorder,
    getSupplierPerformance
  }
}

export default SupplierManager