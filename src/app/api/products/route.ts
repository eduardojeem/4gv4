import { NextRequest, NextResponse } from 'next/server'
import { ProductWithVariants, ProductSearchWithVariants } from '@/types/product-variants'

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

// GET /api/products - Obtener productos con filtros y búsqueda
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const searchQuery: ProductSearchWithVariants = {
      query: searchParams.get('query') || undefined,
      category_id: searchParams.get('category_id') || undefined,
      brand: searchParams.get('brand') || undefined,
      price_min: searchParams.get('price_min') ? parseFloat(searchParams.get('price_min')!) : undefined,
      price_max: searchParams.get('price_max') ? parseFloat(searchParams.get('price_max')!) : undefined,
      in_stock: searchParams.get('in_stock') === 'true',
      sort_by: (searchParams.get('sort_by') as any) || 'name',
      sort_order: (searchParams.get('sort_order') as any) || 'asc',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    }

    // Filtrar productos según los parámetros
    let filteredProducts = [...mockProducts]

    // Filtro por query
    if (searchQuery.query) {
      const query = searchQuery.query.toLowerCase()
      filteredProducts = filteredProducts.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.brand?.toLowerCase().includes(query) ||
        product.variants.some(variant => 
          variant.name.toLowerCase().includes(query) ||
          variant.sku.toLowerCase().includes(query)
        )
      )
    }

    // Filtro por categoría
    if (searchQuery.category_id) {
      filteredProducts = filteredProducts.filter(product => 
        product.category_id === searchQuery.category_id
      )
    }

    // Filtro por marca
    if (searchQuery.brand) {
      filteredProducts = filteredProducts.filter(product => 
        product.brand === searchQuery.brand
      )
    }

    // Filtro por rango de precios
    if (searchQuery.price_min !== undefined || searchQuery.price_max !== undefined) {
      filteredProducts = filteredProducts.filter(product => 
        product.variants.some(variant => {
          const price = variant.price
          return (searchQuery.price_min === undefined || price >= searchQuery.price_min) &&
                 (searchQuery.price_max === undefined || price <= searchQuery.price_max)
        })
      )
    }

    // Filtro por stock
    if (searchQuery.in_stock) {
      filteredProducts = filteredProducts.filter(product => 
        product.variants.some(variant => variant.stock > 0)
      )
    }

    // Ordenamiento
    if (searchQuery.sort_by) {
      filteredProducts.sort((a, b) => {
        let aValue: any, bValue: any
        
        switch (searchQuery.sort_by) {
          case 'name':
            aValue = a.name
            bValue = b.name
            break
          case 'price':
            aValue = Math.min(...a.variants.map(v => v.price))
            bValue = Math.min(...b.variants.map(v => v.price))
            break
          case 'stock':
            aValue = a.variants.reduce((sum, v) => sum + v.stock, 0)
            bValue = b.variants.reduce((sum, v) => sum + v.stock, 0)
            break
          case 'created_at':
            aValue = new Date(a.created_at).getTime()
            bValue = new Date(b.created_at).getTime()
            break
          default:
            return 0
        }

        if (searchQuery.sort_order === 'desc') {
          return bValue > aValue ? 1 : -1
        }
        return aValue > bValue ? 1 : -1
      })
    }

    // Paginación
    const total = filteredProducts.length
    const paginatedProducts = filteredProducts.slice(
      searchQuery.offset || 0, 
      (searchQuery.offset || 0) + (searchQuery.limit || 50)
    )

    return NextResponse.json({
      success: true,
      data: {
        products: paginatedProducts,
        pagination: {
          total,
          limit: searchQuery.limit || 50,
          offset: searchQuery.offset || 0,
          pages: Math.ceil(total / (searchQuery.limit || 50))
        }
      }
    })

  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/products - Crear nuevo producto
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validación básica
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'El nombre del producto es requerido' },
        { status: 400 }
      )
    }

    const newProduct: ProductWithVariants = {
      id: `prod-${Date.now()}`,
      name: body.name,
      description: body.description,
      category_id: body.category_id,
      brand: body.brand,
      has_variants: body.has_variants || false,
      variant_attributes: body.variant_attributes || [],
      base_price: body.base_price,
      base_wholesale_price: body.base_wholesale_price,
      base_cost_price: body.base_cost_price,
      base_stock: body.base_stock,
      base_min_stock: body.base_min_stock,
      variants: body.variants || [],
      images: body.images || [],
      tags: body.tags || [],
      active: body.active !== undefined ? body.active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // En producción, aquí se guardaría en la base de datos
    mockProducts.push(newProduct)

    return NextResponse.json({
      success: true,
      data: newProduct
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT /api/products - Actualizar múltiples productos
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { products } = body

    if (!Array.isArray(products)) {
      return NextResponse.json(
        { success: false, error: 'Se esperaba un array de productos' },
        { status: 400 }
      )
    }

    const updatedProducts = []

    for (const productUpdate of products) {
      const index = mockProducts.findIndex(p => p.id === productUpdate.id)
      if (index !== -1) {
        mockProducts[index] = {
          ...mockProducts[index],
          ...productUpdate,
          updated_at: new Date().toISOString()
        }
        updatedProducts.push(mockProducts[index])
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedProducts
    })

  } catch (error) {
    console.error('Error updating products:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE /api/products - Eliminar múltiples productos
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')?.split(',') || []

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionaron IDs para eliminar' },
        { status: 400 }
      )
    }

    const deletedCount = mockProducts.length
    // En producción, aquí se eliminarían de la base de datos
    ids.forEach(id => {
      const index = mockProducts.findIndex(p => p.id === id)
      if (index !== -1) {
        mockProducts.splice(index, 1)
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        deleted_count: deletedCount - mockProducts.length,
        deleted_ids: ids
      }
    })

  } catch (error) {
    console.error('Error deleting products:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}