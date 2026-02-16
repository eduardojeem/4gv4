import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { createClient } from '@/lib/supabase/server'
import { WebsiteSettingKey } from '@/types/website-settings'
import { validateSetting } from '@/lib/validation/website-settings'
import { sanitizeWebsiteSettings } from '@/lib/sanitization/html'

const VALID_KEYS: WebsiteSettingKey[] = [
  'company_info',
  'hero_stats',
  'hero_content',
  'services',
  'testimonials',
  'maintenance_mode'
]

// Rate limiting: Máximo 10 actualizaciones por minuto por usuario
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minuto

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return { allowed: true, remaining: RATE_LIMIT - 1 }
  }

  if (userLimit.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 }
  }

  userLimit.count++
  return { allowed: true, remaining: RATE_LIMIT - userLimit.count }
}

/**
 * PUT /api/admin/website/settings/[key]
 * Actualizar una configuración específica del sitio web
 */
async function handler(
  request: NextRequest,
  context: { params: Promise<{ key: string }>; user: { id: string; email?: string; role: string } }
) {
  try {
    const { key } = await context.params

    // Validar key
    if (!VALID_KEYS.includes(key as WebsiteSettingKey)) {
      console.warn('Invalid setting key attempted', { key, userId: context.user.id })
      return NextResponse.json(
        { success: false, error: 'Invalid setting key' },
        { status: 400 }
      )
    }

    // Rate limiting
    const rateLimit = checkRateLimit(context.user.id)
    if (!rateLimit.allowed) {
      console.warn('Rate limit exceeded', { 
        userId: context.user.id, 
        key 
      })
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many requests. Please try again later.' 
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + RATE_LIMIT_WINDOW).toISOString()
          }
        }
      )
    }

    const supabase = await createClient()

    const body = await request.json()
    let { value } = body

    if (value === undefined) {
      return NextResponse.json(
        { success: false, error: 'Value is required' },
        { status: 400 }
      )
    }

    // Sanitizar datos para prevenir XSS
    console.log('Sanitizing website setting', { key, userId: context.user.id })
    value = sanitizeWebsiteSettings(value)

    // Validar estructura de datos
    console.log('Validating website setting', { key, userId: context.user.id })
    const validation = validateSetting(key, value)
    
    if (!validation.success) {
      console.warn('Validation failed for website setting', { 
        key, 
        userId: context.user.id,
        error: validation.error 
      })
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    // Usar datos validados
    value = validation.data

    // Obtener valor anterior para auditoría (si existe)
    const { data: existingSetting } = await supabase
      .from('website_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    // Upsert para garantizar que exista la fila
    const { error } = await supabase
      .from('website_settings')
      .upsert({
        key,
        value,
        updated_by: context.user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })

    if (error) {
      console.error('Failed to update website setting', { 
        error: error.message,
        key,
        userId: context.user.id
      })
      const msg = typeof error.message === 'string' ? error.message : 'Update failed'
      const isRls = /row-level security|RLS/i.test(msg)
      const status = isRls ? 403 : 500
      return NextResponse.json(
        { success: false, error: isRls ? 'Forbidden by RLS' : 'Failed to update setting', details: process.env.NODE_ENV === 'development' ? msg : undefined },
        { status }
      )
    }

    // Registrar actualización en audit_log
    try {
      await supabase.from('audit_log').insert({
        user_id: context.user.id,
        action: 'update_website_setting',
        resource: 'website_settings',
        resource_id: key,
        old_values: { value: existingSetting?.value },
        new_values: { value }
      })
    } catch (err) {
      console.error('Failed to log setting update', { error: err })
    }

    console.log('Website setting updated successfully', {
      updatedBy: context.user.id,
      key,
      hasValue: !!value
    })

    return NextResponse.json({
      success: true,
      message: 'Setting updated successfully',
      remaining: rateLimit.remaining
    }, {
      headers: {
        'X-RateLimit-Limit': RATE_LIMIT.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString()
      }
    })
  } catch (error) {
    console.error('Website settings update API error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to update setting' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  return withAdminAuth((req, authContext) => 
    handler(req, { params: context.params, user: authContext.user })
  )(request)
}
