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
  }
]

// GET /api/variants/[id] - Obtener variante específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const variant = mockVariants.find(v => v.id === id)
    
    if (!variant) {
      return NextResponse.json(
        { success: false, error: 'Variante no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: variant
    })

  } catch (error) {
    console.error('Error fetching variant:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT /api/variants/[id] - Actualizar variante específica
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const variantIndex = mockVariants.findIndex(v => v.id === id)
    
    if (variantIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Variante no encontrada' },
        { status: 404 }
      )
    }

    // Verificar SKU único si se está actualizando
    if (body.sku && body.sku !== mockVariants[variantIndex].sku) {
      const existingVariant = mockVariants.find(v => v.sku === body.sku && v.id !== id)
      if (existingVariant) {
        return NextResponse.json(
          { success: false, error: 'El SKU ya existe' },
          { status: 409 }
        )
      }
    }

    // Actualizar variante
    const updatedVariant = {
      ...mockVariants[variantIndex],
      ...body,
      id, // Mantener el ID original
      updated_at: new Date().toISOString()
    }

    mockVariants[variantIndex] = updatedVariant

    return NextResponse.json({
      success: true,
      data: updatedVariant
    })

  } catch (error) {
    console.error('Error updating variant:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE /api/variants/[id] - Eliminar variante específica
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const variantIndex = mockVariants.findIndex(v => v.id === id)
    
    if (variantIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Variante no encontrada' },
        { status: 404 }
      )
    }

    const deletedVariant = mockVariants[variantIndex]
    mockVariants.splice(variantIndex, 1)

    return NextResponse.json({
      success: true,
      data: {
        message: 'Variante eliminada exitosamente',
        deleted_variant: deletedVariant
      }
    })

  } catch (error) {
    console.error('Error deleting variant:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PATCH /api/variants/[id]/stock - Actualizar solo el stock de una variante
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const variantIndex = mockVariants.findIndex(v => v.id === id)
    
    if (variantIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Variante no encontrada' },
        { status: 404 }
      )
    }

    const { stock, operation } = body

    if (operation === 'add') {
      mockVariants[variantIndex].stock += stock
    } else if (operation === 'subtract') {
      mockVariants[variantIndex].stock = Math.max(0, mockVariants[variantIndex].stock - stock)
    } else if (operation === 'set') {
      mockVariants[variantIndex].stock = Math.max(0, stock)
    } else {
      return NextResponse.json(
        { success: false, error: 'Operación no válida. Use: add, subtract, set' },
        { status: 400 }
      )
    }

    mockVariants[variantIndex].updated_at = new Date().toISOString()

    return NextResponse.json({
      success: true,
      data: mockVariants[variantIndex]
    })

  } catch (error) {
    console.error('Error updating variant stock:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}