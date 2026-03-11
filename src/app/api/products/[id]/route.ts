import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireStaff, getAuthResponse } from '@/lib/auth/require-auth'
import { productUpdateSchema } from '@/lib/validation/schemas'
import { logger } from '@/lib/logger'

// GET /api/products/[id] - Obtener producto especifico (usuario autenticado)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const { id } = await params
    const supabase = await createClient()

    const { data: product, error } = await supabase
      .from('products')
      .select('*, category:categories(id, name)')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      logger.error('Failed to fetch product by id', { productId: id, error: error.message })
      throw error
    }

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: product,
    })
  } catch (error) {
    logger.error('Product detail API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT /api/products/[id] - Actualizar producto especifico (staff only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()

    const validationResult = productUpdateSchema.safeParse({
      ...body,
      id,
    })

    if (!validationResult.success) {
      const details = validationResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))

      return NextResponse.json(
        { success: false, error: 'Validation failed', details },
        { status: 400 }
      )
    }

    const validated = validationResult.data
    const updatePayload: Record<string, unknown> = {}

    const allowedKeys: Array<keyof typeof validated> = [
      'name',
      'description',
      'category_id',
      'supplier_id',
      'brand',
      'stock_quantity',
      'min_stock',
      'purchase_price',
      'sale_price',
      'is_active',
      'barcode',
      'unit_measure',
    ]

    for (const key of allowedKeys) {
      const value = validated[key]
      if (value !== undefined) {
        updatePayload[key] = value
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay campos para actualizar' },
        { status: 400 }
      )
    }

    const { data: updatedProduct, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select('*, category:categories(id, name)')
      .maybeSingle()

    if (error) {
      logger.error('Failed to update product by id', { productId: id, error: error.message })
      throw error
    }

    if (!updatedProduct) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedProduct,
    })
  } catch (error) {
    logger.error('Product update by id API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Eliminar producto especifico (staff only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const { id } = await params
    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('products')
      .select('id,name,sku')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to verify product before delete', { productId: id, error: existingError.message })
      throw existingError
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const { error } = await supabase.from('products').delete().eq('id', id)

    if (error) {
      logger.error('Failed to delete product by id', { productId: id, error: error.message })
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Producto eliminado exitosamente',
        deleted_product: existing,
      },
    })
  } catch (error) {
    logger.error('Product delete by id API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
