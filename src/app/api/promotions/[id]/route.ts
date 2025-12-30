import { NextRequest, NextResponse } from 'next/server'
import { Promotion } from '@/types/promotions'

// Mock data - en producción esto vendría de la base de datos
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
  }
]

// GET - Obtener promoción específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const promotion = mockPromotions.find(p => p.id === id)

    if (!promotion) {
      return NextResponse.json(
        { error: 'Promoción no encontrada' },
        { status: 404 }
      )
    }

    // Calcular estadísticas adicionales
    const stats = {
      usage_percentage: promotion.usage_limit 
        ? (promotion.usage_count / promotion.usage_limit) * 100 
        : 0,
      is_expired: promotion.end_date 
        ? new Date() > new Date(promotion.end_date)
        : false,
      is_active_now: promotion.is_active && 
        new Date() >= new Date(promotion.start_date) &&
        (!promotion.end_date || new Date() <= new Date(promotion.end_date)),
      days_remaining: promotion.end_date
        ? Math.max(0, Math.ceil((new Date(promotion.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        : null
    }

    return NextResponse.json({
      ...promotion,
      stats
    })

  } catch (error) {
    console.error('Error fetching promotion:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar promoción específica
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const index = mockPromotions.findIndex(p => p.id === id)

    if (index === -1) {
      return NextResponse.json(
        { error: 'Promoción no encontrada' },
        { status: 404 }
      )
    }

    // Validaciones
    if (body.name) {
      // Verificar nombre único (excluyendo la promoción actual)
      const existingPromotion = mockPromotions.find(p => 
        p.id !== id && p.name.toLowerCase() === body.name.toLowerCase()
      )
      if (existingPromotion) {
        return NextResponse.json(
          { error: 'Ya existe otra promoción con ese nombre' },
          { status: 409 }
        )
      }
    }

    // Validar fechas
    const startDate = body.start_date || mockPromotions[index].start_date
    const endDate = body.end_date || mockPromotions[index].end_date
    
    if (endDate && new Date(startDate) >= new Date(endDate)) {
      return NextResponse.json(
        { error: 'La fecha de fin debe ser posterior a la fecha de inicio' },
        { status: 400 }
      )
    }

    // Actualizar promoción
    const updatedPromotion = {
      ...mockPromotions[index],
      ...body,
      id, // Asegurar que el ID no cambie
      updated_at: new Date().toISOString()
    }

    mockPromotions[index] = updatedPromotion

    return NextResponse.json(updatedPromotion)

  } catch (error) {
    console.error('Error updating promotion:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar promoción específica
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const index = mockPromotions.findIndex(p => p.id === id)

    if (index === -1) {
      return NextResponse.json(
        { error: 'Promoción no encontrada' },
        { status: 404 }
      )
    }

    // Verificar si la promoción está siendo utilizada activamente
    const promotion = mockPromotions[index]
    if (promotion.usage_count > 0) {
      // En lugar de eliminar, desactivar la promoción
      mockPromotions[index] = {
        ...promotion,
        is_active: false,
        updated_at: new Date().toISOString()
      }

      return NextResponse.json({
        message: 'Promoción desactivada debido a uso existente',
        promotion: mockPromotions[index]
      })
    }

    // Eliminar promoción si no tiene uso
    const deletedPromotion = mockPromotions.splice(index, 1)[0]

    return NextResponse.json({
      message: 'Promoción eliminada exitosamente',
      promotion: deletedPromotion
    })

  } catch (error) {
    console.error('Error deleting promotion:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PATCH - Operaciones específicas en la promoción
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const index = mockPromotions.findIndex(p => p.id === id)

    if (index === -1) {
      return NextResponse.json(
        { error: 'Promoción no encontrada' },
        { status: 404 }
      )
    }

    const promotion = mockPromotions[index]

    // Operaciones específicas
    switch (body.operation) {
      case 'increment_usage':
        const incrementAmount = body.amount || 1
        const newUsage = promotion.usage_count + incrementAmount
        
        // Verificar límite de uso
        if (promotion.usage_limit && newUsage > promotion.usage_limit) {
          return NextResponse.json(
            { error: 'Se excedería el límite de uso de la promoción' },
            { status: 400 }
          )
        }

        mockPromotions[index] = {
          ...promotion,
          usage_count: newUsage,
          updated_at: new Date().toISOString()
        }
        break

      case 'reset_usage':
        mockPromotions[index] = {
          ...promotion,
          usage_count: 0,
          updated_at: new Date().toISOString()
        }
        break

      case 'toggle_active':
        mockPromotions[index] = {
          ...promotion,
          is_active: !promotion.is_active,
          updated_at: new Date().toISOString()
        }
        break

      case 'extend_date':
        if (!body.new_end_date) {
          return NextResponse.json(
            { error: 'Se requiere new_end_date para extender la promoción' },
            { status: 400 }
          )
        }

        if (new Date(body.new_end_date) <= new Date(promotion.start_date)) {
          return NextResponse.json(
            { error: 'La nueva fecha de fin debe ser posterior a la fecha de inicio' },
            { status: 400 }
          )
        }

        mockPromotions[index] = {
          ...promotion,
          end_date: body.new_end_date,
          updated_at: new Date().toISOString()
        }
        break

      default:
        return NextResponse.json(
          { error: 'Operación no válida' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      message: 'Operación completada exitosamente',
      promotion: mockPromotions[index]
    })

  } catch (error) {
    console.error('Error in promotion operation:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}