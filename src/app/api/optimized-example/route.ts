import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  checkRateLimit, 
  recordAPIMetric
} from '@/lib/middleware/api-optimization'
import { withOptimization } from '@/lib/api/optimization'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Ejemplo 1: Endpoint con optimización usando withOptimization
async function getOptimizedProducts(request: NextRequest) {
  const startTime = Date.now()

  // Usar withOptimization del módulo de librería; no acepta config
  return withOptimization(async (request: NextRequest) => {
    const category = request.nextUrl.searchParams.get('category')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
    
    // Construir query optimizada
    let query = supabase
      .from('products')
      .select('*')
      .limit(limit)

    if (category) {
      query = query.eq('category', category)
    }

    // Ejecutar query
    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const response = NextResponse.json({
      data,
      meta: {
        count: data?.length || 0,
        queryTime: Date.now() - startTime,
        cached: false
      }
    })

    return response
  })(request)
}

// Ejemplo 2: Endpoint usando la función optimizada
export async function GET(request: NextRequest) {
  return await getOptimizedProducts(request)
}

// Ejemplo 3: Endpoint manual con helpers de optimización (eliminado para evitar duplicación)

// Ejemplo 3: Endpoint POST con invalidación de cache
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Rate limiting más estricto para operaciones de escritura
    const rateLimitResult = await checkRateLimit(request, {
      maxRequests: 50,
      windowMs: 15 * 60 * 1000
    })

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
      
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    }

    // Procesar datos
    const body = await request.json()
    
    // Validación básica
    if (!body.name || !body.price) {
      return NextResponse.json(
        { error: 'Name and price are required' },
        { status: 400 }
      )
    }

    // Insertar producto
    const { data, error } = await supabase
      .from('products')
      .insert(body)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Invalidar caches relacionados
    const { invalidateCacheByTags } = await import('@/lib/middleware/api-optimization')
    invalidateCacheByTags(['products', 'inventory'])

    const response = NextResponse.json({
      data,
      message: 'Product created successfully'
    }, { status: 201 })

    // Registrar métricas
    recordAPIMetric(request, response, startTime)

    return response

  } catch (error) {
    console.error('Error creating product:', error)
    
    const errorResponse = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )

    recordAPIMetric(request, errorResponse, startTime)
    return errorResponse
  }
}

// Ejemplo 4: Endpoint con cache condicional
export async function PUT(request: NextRequest) {
  const startTime = Date.now()

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      return response
    }

    const body = await request.json()

    // Actualizar producto
    const { data, error } = await supabase
      .from('products')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Invalidar caches específicos
    const { cacheManager } = await import('@/lib/api/optimization')
    
    // Invalidar cache del producto específico
    cacheManager.delete(`product:${id}`)
    
    // Invalidar caches por tags
    const { invalidateCacheByTags } = await import('@/lib/middleware/api-optimization')
    invalidateCacheByTags(['products', 'inventory'])

    const response = NextResponse.json({
      data,
      message: 'Product updated successfully'
    })

    recordAPIMetric(request, response, startTime)
    return response

  } catch (error) {
    console.error('Error updating product:', error)
    
    const errorResponse = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )

    recordAPIMetric(request, errorResponse, startTime)
    return errorResponse
  }
}

// Nota: La clase OptimizedProductsAPI no existe en el código actual.
// Si se necesita implementar una clase con decoradores, se debería crear
// una implementación completa que use el decorador optimizedEndpoint correctamente.
// Por ahora, se elimina esta sección ya que causa errores de compilación.

// Instanciar la clase para usar el decorador - COMENTADO PORQUE LA CLASE NO EXISTE
// const productsAPI = new OptimizedProductsAPI()

// Exportar método con decorador como alternativa - COMENTADO PORQUE LA CLASE NO EXISTE
// export { productsAPI }