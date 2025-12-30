import { NextRequest, NextResponse } from 'next/server'

// Tipos para ventas
interface SaleItem {
  id: string
  product_id: string
  variant_id?: string
  sku: string
  name: string
  quantity: number
  unit_price: number
  discount_amount: number
  total_price: number
  attributes?: Array<{
    attribute_name: string
    value: string
    color_hex?: string
  }>
  // Soporte para variantes
  variant_attributes?: Array<{
    attribute_name: string
    value_name: string
  }>
  // Soporte para promociones
  applied_promotions?: Array<{
    promotion_id: string
    promotion_name: string
    discount_amount: number
    discount_type: 'percentage' | 'fixed'
  }>
}

interface Sale {
  id: string
  sale_number: string
  customer_id?: string
  customer_name?: string
  items: SaleItem[]
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  payment_method: string
  payment_status: 'pending' | 'completed' | 'refunded'
  notes?: string
  cashier_id: string
  cashier_name: string
  register_id: string
  created_at: string
  updated_at: string
  // Soporte para promociones
  applied_promotions?: Array<{
    promotion_id: string
    promotion_name: string
    total_discount: number
    items_affected: string[] // IDs de items afectados
  }>
  promotion_discount_total?: number
}

// Mock data para desarrollo
const mockSales: Sale[] = [
  {
    id: 'sale-1',
    sale_number: 'SALE-001',
    customer_id: 'customer-1',
    customer_name: 'Juan Pérez',
    items: [
      {
        id: 'item-1',
        product_id: 'product-1',
        name: 'Smartphone Samsung Galaxy A54',
        sku: 'SAM-A54-128-BLK',
        quantity: 1,
        unit_price: 2500000,
        total_price: 2250000,
        discount_amount: 250000,
        variant_id: 'variant-1',
        variant_attributes: [
          { attribute_name: 'Color', value_name: 'Negro' },
          { attribute_name: 'Almacenamiento', value_name: '128GB' }
        ],
        applied_promotions: [
          {
            promotion_id: 'promo-1',
            promotion_name: 'Descuento de Bienvenida',
            discount_amount: 250000,
            discount_type: 'percentage'
          }
        ]
      },
      {
        id: 'item-2',
        product_id: 'product-2',
        name: 'Auriculares Bluetooth Sony',
        sku: 'SONY-WH1000-WHT',
        quantity: 2,
        unit_price: 850000,
        total_price: 1700000,
        discount_amount: 0,
        variant_id: 'variant-2',
        variant_attributes: [
          { attribute_name: 'Color', value_name: 'Blanco' }
        ]
      }
    ],
    subtotal: 4200000,
    tax_amount: 798000,
    discount_amount: 420000,
    total_amount: 4578000,
    payment_method: 'card',
    payment_status: 'completed',
    cashier_id: 'cashier-1',
    cashier_name: 'María García',
    register_id: 'register-1',
    notes: 'Cliente frecuente',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z',
    applied_promotions: [
      {
        promotion_id: 'promo-1',
        promotion_name: 'Descuento de Bienvenida',
        total_discount: 250000,
        items_affected: ['item-1']
      }
    ],
    promotion_discount_total: 250000
  }
]

// GET /api/sales - Obtener todas las ventas con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const customerId = searchParams.get('customer_id')
    const paymentStatus = searchParams.get('payment_status')
    const paymentMethod = searchParams.get('payment_method')
    const cashierId = searchParams.get('cashier_id')
    const registerId = searchParams.get('register_id')

    let filteredSales = [...mockSales]

    // Filtrar por fechas
    if (startDate) {
      filteredSales = filteredSales.filter(sale => 
        new Date(sale.created_at) >= new Date(startDate)
      )
    }
    if (endDate) {
      filteredSales = filteredSales.filter(sale => 
        new Date(sale.created_at) <= new Date(endDate)
      )
    }

    // Filtrar por cliente
    if (customerId) {
      filteredSales = filteredSales.filter(sale => sale.customer_id === customerId)
    }

    // Filtrar por estado de pago
    if (paymentStatus) {
      filteredSales = filteredSales.filter(sale => sale.payment_status === paymentStatus)
    }

    // Filtrar por método de pago
    if (paymentMethod) {
      filteredSales = filteredSales.filter(sale => sale.payment_method === paymentMethod)
    }

    // Filtrar por cajero
    if (cashierId) {
      filteredSales = filteredSales.filter(sale => sale.cashier_id === cashierId)
    }

    // Filtrar por caja registradora
    if (registerId) {
      filteredSales = filteredSales.filter(sale => sale.register_id === registerId)
    }

    // Ordenar por fecha (más recientes primero)
    filteredSales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Paginación
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedSales = filteredSales.slice(startIndex, endIndex)

    // Calcular estadísticas
    const totalSales = filteredSales.length
    const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.total_amount, 0)
    const averageAmount = totalSales > 0 ? totalAmount / totalSales : 0

    return NextResponse.json({
      success: true,
      data: paginatedSales,
      pagination: {
        page,
        limit,
        total: totalSales,
        pages: Math.ceil(totalSales / limit)
      },
      statistics: {
        total_sales: totalSales,
        total_amount: totalAmount,
        average_amount: averageAmount
      }
    })

  } catch (error) {
    console.error('Error fetching sales:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/sales - Crear nueva venta
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validaciones básicas
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'La venta debe tener al menos un item' },
        { status: 400 }
      )
    }

    if (!body.cashier_id || !body.register_id) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: cashier_id, register_id' },
        { status: 400 }
      )
    }

    // Generar número de venta
    const saleNumber = `VTA-${String(mockSales.length + 1).padStart(3, '0')}`

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      sale_number: saleNumber,
      customer_id: body.customer_id,
      customer_name: body.customer_name,
      items: body.items,
      subtotal: body.subtotal || 0,
      discount_amount: body.discount_amount || 0,
      tax_amount: body.tax_amount || 0,
      total_amount: body.total_amount || 0,
      payment_method: body.payment_method || 'cash',
      payment_status: body.payment_status || 'completed',
      notes: body.notes,
      cashier_id: body.cashier_id,
      cashier_name: body.cashier_name || 'Cajero',
      register_id: body.register_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    mockSales.push(newSale)

    return NextResponse.json({
      success: true,
      data: newSale
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating sale:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}