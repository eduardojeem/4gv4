import { NextRequest, NextResponse } from 'next/server'
import type { Promotion } from '@/types/promotion'

// Mock data para desarrollo
const mockPromotions: Promotion[] = [
  {
    id: 'promo-1',
    code: 'WELCOME10',
    name: 'Descuento de Bienvenida',
    description: '10% de descuento en tu primera compra',
    type: 'percentage',
    value: 10,
    min_purchase: 50000,
    start_date: '2024-01-01T00:00:00Z',
    end_date: '2024-12-31T23:59:59Z',
    is_active: true,
    usage_count: 25,
    usage_limit: 100,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'promo-2',
    code: 'BUY2GET1',
    name: 'Compra 2 lleva 3',
    description: 'Lleva 3 productos pagando solo 2',
    type: 'fixed',
    value: 0,
    applicable_categories: ['Electrónicos'],
    start_date: '2024-01-15T00:00:00Z',
    end_date: '2024-02-15T23:59:59Z',
    is_active: true,
    usage_count: 12,
    usage_limit: 50,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z'
  },
  {
    id: 'promo-3',
    code: 'BULK15',
    name: 'Descuento por Volumen',
    description: '15% de descuento en compras mayores a $200.000',
    type: 'percentage',
    value: 15,
    min_purchase: 200000,
    start_date: '2024-01-01T00:00:00Z',
    end_date: '2024-12-31T23:59:59Z',
    is_active: true,
    usage_count: 45,
    usage_limit: 200,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'promo-4',
    code: 'FREESHIP',
    name: 'Envío Gratis',
    description: 'Envío gratuito en compras superiores a $100.000',
    type: 'fixed',
    value: 0,
    min_purchase: 100000,
    start_date: '2024-01-01T00:00:00Z',
    end_date: '2024-12-31T23:59:59Z',
    is_active: true,
    usage_count: 78,
    usage_limit: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
]

// GET - Obtener promociones con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parámetros de filtrado
    const active = searchParams.get('active')
    const type = searchParams.get('type') as PromotionType | null
    const category = searchParams.get('category')
    const product_id = searchParams.get('product_id')
    const current_date = searchParams.get('current_date')
    
    // Parámetros de paginación
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    let filteredPromotions = [...mockPromotions]

    // Aplicar filtros
    if (active !== null) {
      const isActive = active === 'true'
      filteredPromotions = filteredPromotions.filter(p => p.is_active === isActive)
    }

    if (type) {
      filteredPromotions = filteredPromotions.filter(p => p.type === type)
    }

    if (category) {
      filteredPromotions = filteredPromotions.filter(p => 
        p.applicable_categories?.includes(category)
      )
    }

    if (product_id) {
      filteredPromotions = filteredPromotions.filter(p => 
        p.applicable_products?.includes(product_id)
      )
    }

    // Filtrar por fecha actual (promociones válidas)
    if (current_date) {
      const checkDate = new Date(current_date)
      filteredPromotions = filteredPromotions.filter(p => {
        const startDate = new Date(p.start_date)
        const endDate = p.end_date ? new Date(p.end_date) : null
        
        return checkDate >= startDate && (!endDate || checkDate <= endDate)
      })
    }

    // Ordenar por fecha de creación (más recientes primero)
    filteredPromotions.sort((a, b) => 
      new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
    )

    // Aplicar paginación
    const paginatedPromotions = filteredPromotions.slice(offset, offset + limit)

    return NextResponse.json({
      promotions: paginatedPromotions,
      pagination: {
        page,
        limit,
        total: filteredPromotions.length,
        pages: Math.ceil(filteredPromotions.length / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching promotions:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST - Crear nueva promoción
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validaciones básicas
    if (!body.name || !body.type || !body.code) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, type, code' },
        { status: 400 }
      )
    }

    // Validar fechas
    if (body.end_date && new Date(body.start_date) >= new Date(body.end_date)) {
      return NextResponse.json(
        { error: 'La fecha de fin debe ser posterior a la fecha de inicio' },
        { status: 400 }
      )
    }

    // Verificar código único
    const existingPromotion = mockPromotions.find(p => 
      p.code.toLowerCase() === body.code.toLowerCase()
    )
    if (existingPromotion) {
      return NextResponse.json(
        { error: 'Ya existe una promoción con ese código' },
        { status: 409 }
      )
    }

    // Crear nueva promoción
    const newPromotion: Promotion = {
      id: `promo-${Date.now()}`,
      code: body.code,
      name: body.name,
      description: body.description || '',
      type: body.type,
      value: body.value || 0,
      min_purchase: body.min_purchase,
      max_discount: body.max_discount,
      applicable_products: body.applicable_products,
      applicable_categories: body.applicable_categories,
      start_date: body.start_date,
      end_date: body.end_date,
      is_active: body.is_active ?? true,
      usage_count: 0,
      usage_limit: body.usage_limit,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // En producción, guardar en base de datos
    mockPromotions.push(newPromotion)

    return NextResponse.json(newPromotion, { status: 201 })

  } catch (error) {
    console.error('Error creating promotion:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar múltiples promociones (ej: cambiar prioridades)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!Array.isArray(body.promotions)) {
      return NextResponse.json(
        { error: 'Se requiere un array de promociones' },
        { status: 400 }
      )
    }

    const updatedPromotions: Promotion[] = []

    for (const promotionUpdate of body.promotions) {
      const index = mockPromotions.findIndex(p => p.id === promotionUpdate.id)
      
      if (index !== -1) {
        mockPromotions[index] = {
          ...mockPromotions[index],
          ...promotionUpdate,
          updated_at: new Date().toISOString()
        }
        updatedPromotions.push(mockPromotions[index])
      }
    }

    return NextResponse.json({
      updated: updatedPromotions,
      count: updatedPromotions.length
    })

  } catch (error) {
    console.error('Error updating promotions:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}