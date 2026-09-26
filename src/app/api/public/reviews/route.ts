import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicOrganization } from '@/lib/saas/public-tenant'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { verifyTurnstileToken } from '@/lib/security/turnstile'

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
  captcha_token: z.string().trim().max(4096).optional().nullable(),
  invite_token: z.string().trim().min(32).max(256).optional().nullable(),
})

const verificationFilterSchema = z.enum(['all', 'verified', 'purchase', 'repair']).catch('all')

function safePositiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), maximum)
}

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
    const limit = safePositiveInteger(searchParams.get('limit'), 10, 50)
    const offsetValue = Number(searchParams.get('offset') || 0)
    const offset = Number.isFinite(offsetValue) ? Math.max(Math.trunc(offsetValue), 0) : 0
    const verification = verificationFilterSchema.parse(searchParams.get('verification') || 'all')

    let reviewsQuery = supabase
      .from('organization_reviews')
      .select(
        'id, reviewer_name, rating, comment, created_at, verification_type, business_response, responded_at',
        { count: 'exact' },
      )
      .eq('organization_id', organization.id)
      .eq('moderation_status', 'published')

    if (verification === 'verified') {
      reviewsQuery = reviewsQuery.in('verification_type', ['purchase', 'repair'])
    } else if (verification === 'purchase' || verification === 'repair') {
      reviewsQuery = reviewsQuery.eq('verification_type', verification)
    }

    const { data: reviews, error, count } = await reviewsQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      logger.error('[reviews] Error fetching reviews', { error })
      return NextResponse.json(
        { success: false, error: 'Error al obtener reseñas' },
        { status: 500 }
      )
    }

    const { data: statsRows, error: statsError } = await supabase
      .rpc('get_organization_review_public_stats', { p_organization_id: organization.id })

    if (statsError) {
      logger.error('[reviews] Error fetching public stats', { error: statsError })
    }

    const stats = statsRows?.[0]

    return NextResponse.json({
      success: true,
      data: {
        reviews: reviews ?? [],
        stats: {
          average: Number(stats?.average ?? 0),
          count: Number(stats?.count ?? 0),
          verifiedAverage: Number(stats?.verified_average ?? 0),
          verifiedCount: Number(stats?.verified_count ?? 0),
          respondedCount: Number(stats?.responded_count ?? 0),
          satisfactionRate: Number(stats?.satisfaction_rate ?? 0),
          breakdown: stats?.breakdown ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
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
  try {
    const supabase = createAdminSupabase()
    const organization = await resolvePublicOrganization(request, supabase)

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    const clientIp = getClientIp(request)
    const allowed = await rateLimiter.check(
      `${organization.id}:${clientIp}`,
      REVIEW_RATE_LIMIT,
      REVIEW_RATE_WINDOW_MS,
    )
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Has enviado demasiadas reseñas. Intenta nuevamente mañana.' },
        { status: 429 },
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

    const { reviewer_name, reviewer_email, rating, comment, captcha_token, invite_token } = validation.data
    const captcha = await verifyTurnstileToken(captcha_token, clientIp)
    if (!captcha.success) {
      const notConfigured = 'reason' in captcha && captcha.reason === 'not_configured'
      return NextResponse.json(
        {
          success: false,
          error: notConfigured
            ? 'La verificación anti-bots no está configurada.'
            : 'No pudimos validar la verificación de seguridad. Intenta nuevamente.',
        },
        { status: notConfigured ? 503 : 400 },
      )
    }

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

    const normalizedEmail = reviewer_email?.toLowerCase() || null
    const reviewResult = invite_token
      ? await supabase.rpc('submit_verified_organization_review', {
          p_organization_id: organization.id,
          p_token_hash: createHash('sha256').update(invite_token).digest('hex'),
          p_reviewer_name: reviewer_name,
          p_reviewer_email: normalizedEmail,
          p_rating: rating,
          p_comment: comment || null,
        }).single()
      : await supabase
          .from('organization_reviews')
          .insert({
            organization_id: organization.id,
            reviewer_name,
            reviewer_email: normalizedEmail,
            rating,
            comment: comment || null,
            moderation_status: 'pending',
            verification_type: 'open',
          })
          .select('id, created_at')
          .single()

    const { data: review, error } = reviewResult

    if (error) {
      logger.error('[reviews] Error creating review', { error })
      return NextResponse.json(
        {
          success: false,
          error: invite_token
            ? 'El enlace verificado no es válido, ya fue utilizado o venció.'
            : 'No se pudo enviar la reseña',
        },
        { status: invite_token ? 409 : 500 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: review,
        message: '¡Gracias por tu reseña! Quedó pendiente de revisión antes de publicarse.',
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
