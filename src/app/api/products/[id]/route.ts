import { NextRequest, NextResponse } from 'next/server'
import { ProductWithVariants } from '@/types/product-variants'

// Mock data - En producción esto vendría de la base de datos
const mockProducts: ProductWithVariants[] = [
  {
    id: 'prod-1',
    name: 'Camiseta Básica',
    description: 'Camiseta de algodón básica disponible en varios colores y tallas',
    category_id: 'cat-1',
    brand: 'BasicWear',
    has_variants: true,
    variant_attributes: ['attr-1', 'attr-2'],
    variants: [
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
    ],
    images: ['/products/camiseta-basica.jpg'],
    tags: ['ropa', 'casual', 'algodón'],
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

// GET /api/products/[id] - Obtener producto específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const product = mockProducts.find(p => p.id === id)
    
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: product
    })

  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT /api/products/[id] - Actualizar producto específico
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const productIndex = mockProducts.findIndex(p => p.id === id)
    
    if (productIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    // Actualizar producto
    const updatedProduct = {
      ...mockProducts[productIndex],
      ...body,
      id, // Mantener el ID original
      updated_at: new Date().toISOString()
    }

    mockProducts[productIndex] = updatedProduct

    return NextResponse.json({
      success: true,
      data: updatedProduct
    })

  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Eliminar producto específico
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const productIndex = mockProducts.findIndex(p => p.id === id)
    
    if (productIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const deletedProduct = mockProducts[productIndex]
    mockProducts.splice(productIndex, 1)

    return NextResponse.json({
      success: true,
      data: {
        message: 'Producto eliminado exitosamente',
        deleted_product: deletedProduct
      }
    })

  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}