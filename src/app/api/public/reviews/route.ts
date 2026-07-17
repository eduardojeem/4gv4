import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicOrganization } from '@/lib/saas/public-tenant'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

// Rate limit: 3 reseñas por IP cada 24 horas
const REVIEW_RATE_LIMIT = 3
const REVIEW_RATE_WINDOW_MS = 24 * 60 * 60 * 1000

const reviewSchema = z.object({
  reviewer_name: z.string({ error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar los 100 caracteres'),
  reviewer_email: z.string()
    .trim()
    .email('El email no es válido')
    .optional()
    .or(z.literal(''))
    .nullable(),
  rating: z.number({ error: 'La calificación es obligatoria' })
    .int('La calificación debe ser un número entero')
    .min(1, 'La calificación mínima es 1')
    .max(5, 'La calificación máxima es 5'),
  comment: z.string()
    .trim()
    .max(500, 'El comentario no puede superar los 500 caracteres')
    .optional()
    .nullable(),
})

/**
 * GET /api/public/reviews?limit=10&offset=0
 * Obtener reseñas aprobadas de la organización (paginadas)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabase()
    const organization = await resolvePublicOrganization(request, supabase)

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 10), 50)
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0)

    const { data: reviews, error, count } = await supabase
      .from('organization_reviews')
      .select('id, reviewer_name, rating, comment, created_at', { count: 'exact' })
      .eq('organization_id', organization.id)
      .eq('is_approved', true)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      logger.error('[reviews] Error fetching reviews', { error })
      return NextResponse.json(
        { success: false, error: 'Error al obtener reseñas' },
        { status: 500 }
      )
    }

    // Obtener stats de la organización
    const { data: org } = await supabase
      .from('organizations')
      .select('review_rating_avg, review_count')
      .eq('id', organization.id)
      .single()

    return NextResponse.json({
      success: true,
      data: {
        reviews: reviews ?? [],
        stats: {
          average: Number(org?.review_rating_avg ?? 0),
          count: org?.review_count ?? 0,
        },
        pagination: {
          total: count ?? 0,
          limit,
          offset,
        },
      },
    })
  } catch (error) {
    logger.error('[reviews] Unexpected error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/public/reviews
 * Enviar una nueva reseña (requiere moderación)
 */
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)
  const allowed = await rateLimiter.check(clientIp, REVIEW_RATE_LIMIT, REVIEW_RATE_WINDOW_MS)
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Has enviado demasiadas reseñas. Intenta nuevamente mañana.' },
      { status: 429 }
    )
  }

  try {
    const supabase = createAdminSupabase()
    const organization = await resolvePublicOrganization(request, supabase)

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = reviewSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { reviewer_name, reviewer_email, rating, comment } = validation.data

    // Verificar si ya existe una reseña reciente con el mismo email
    if (reviewer_email) {
      const { data: existing } = await supabase
        .from('organization_reviews')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('reviewer_email', reviewer_email.toLowerCase())
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Ya enviaste una reseña recientemente. Puedes enviar otra en unos días.' },
          { status: 409 }
        )
      }
    }

    const { data: review, error } = await supabase
      .from('organization_reviews')
      .insert({
        organization_id: organization.id,
        reviewer_name,
        reviewer_email: reviewer_email?.toLowerCase() || null,
        rating,
        comment: comment || null,
        is_approved: true, // Aprobación automática para transparencia
      })
      .select('id, created_at')
      .single()

    if (error) {
      logger.error('[reviews] Error creating review', { error })
      return NextResponse.json(
        { success: false, error: 'No se pudo enviar la reseña' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: review,
        message: '¡Gracias por tu reseña! Ya está publicada.',
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('[reviews] Unexpected error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    )
  }
}
