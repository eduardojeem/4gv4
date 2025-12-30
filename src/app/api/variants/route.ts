import { NextRequest, NextResponse } from 'next/server'
import { ProductVariant } from '@/types/product-variants'

// Mock data - En producción esto vendría de la base de datos
const mockVariants: ProductVariant[] = [
  {
    id: 'var-1',
    product_id: 'prod-1',
    sku: 'CAM-ROJO-S',
    name: 'Camiseta Básica - Rojo S',
    attributes: [
      { attribute_id: 'attr-1', attribute_name: 'Color', option_id: 'opt-1', value: 'Rojo', color_hex: '#FF0000' },
      { attribute_id: 'attr-2', attribute_name: 'Talla', option_id: 'opt-5', value: 'S' }
    ],
    price: 25.00,
    wholesale_price: 18.00,
    cost_price: 12.00,
    stock: 15,
    min_stock: 5,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'var-2',
    product_id: 'prod-1',
    sku: 'CAM-AZUL-M',
    name: 'Camiseta Básica - Azul M',
    attributes: [
      { attribute_id: 'attr-1', attribute_name: 'Color', option_id: 'opt-2', value: 'Azul', color_hex: '#0000FF' },
      { attribute_id: 'attr-2', attribute_name: 'Talla', option_id: 'opt-6', value: 'M' }
    ],
    price: 25.00,
    wholesale_price: 18.00,
    cost_price: 12.00,
    stock: 20,
    min_stock: 5,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

// GET /api/variants - Obtener todas las variantes con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id')
    const sku = searchParams.get('sku')
    const active = searchParams.get('active')
    const lowStock = searchParams.get('low_stock')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    let filteredVariants = [...mockVariants]

    // Filtrar por producto
    if (productId) {
      filteredVariants = filteredVariants.filter(v => v.product_id === productId)
    }

    // Filtrar por SKU
    if (sku) {
      filteredVariants = filteredVariants.filter(v => 
        v.sku.toLowerCase().includes(sku.toLowerCase())
      )
    }

    // Filtrar por estado activo
    if (active !== null) {
      const isActive = active === 'true'
      filteredVariants = filteredVariants.filter(v => v.active === isActive)
    }

    // Filtrar por stock bajo
    if (lowStock === 'true') {
      filteredVariants = filteredVariants.filter(v => v.stock <= v.min_stock)
    }

    // Paginación
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedVariants = filteredVariants.slice(startIndex, endIndex)

    return NextResponse.json({
      success: true,
      data: paginatedVariants,
      pagination: {
        page,
        limit,
        total: filteredVariants.length,
        pages: Math.ceil(filteredVariants.length / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching variants:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/variants - Crear nueva variante
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validaciones básicas
    if (!body.product_id || !body.sku || !body.name) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: product_id, sku, name' },
        { status: 400 }
      )
    }

    // Verificar que el SKU no exista
    const existingVariant = mockVariants.find(v => v.sku === body.sku)
    if (existingVariant) {
      return NextResponse.json(
        { success: false, error: 'El SKU ya existe' },
        { status: 409 }
      )
    }

    const newVariant: ProductVariant = {
      id: `var-${Date.now()}`,
      product_id: body.product_id,
      sku: body.sku,
      name: body.name,
      attributes: body.attributes || [],
      price: body.price || 0,
      wholesale_price: body.wholesale_price || 0,
      cost_price: body.cost_price || 0,
      stock: body.stock || 0,
      min_stock: body.min_stock || 0,
      active: body.active !== undefined ? body.active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    mockVariants.push(newVariant)

    return NextResponse.json({
      success: true,
      data: newVariant
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating variant:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT /api/variants - Actualización masiva de variantes
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { variants } = body

    if (!Array.isArray(variants)) {
      return NextResponse.json(
        { success: false, error: 'Se esperaba un array de variantes' },
        { status: 400 }
      )
    }

    const updatedVariants: ProductVariant[] = []

    for (const variantData of variants) {
      const variantIndex = mockVariants.findIndex(v => v.id === variantData.id)
      
      if (variantIndex !== -1) {
        const updatedVariant = {
          ...mockVariants[variantIndex],
          ...variantData,
          updated_at: new Date().toISOString()
        }
        
        mockVariants[variantIndex] = updatedVariant
        updatedVariants.push(updatedVariant)
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedVariants,
      message: `${updatedVariants.length} variantes actualizadas`
    })

  } catch (error) {
    console.error('Error updating variants:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}