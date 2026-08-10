import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { isWebsiteSettingKey, validateSetting } from '@/lib/validation/website-settings'
import { sanitizeWebsiteSettings } from '@/lib/sanitization/html'
import { resolveWebsiteAdminOrganizationId } from '@/lib/website/admin-organization'

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
  context: { 
    params: Promise<{ key: string }>; 
    user: { id: string; email?: string; role: string };
    organizationId: string | null;
  }
) {
  try {
    const { key } = await context.params

    // Validar key
    if (!isWebsiteSettingKey(key)) {
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

    const orgId = await resolveWebsiteAdminOrganizationId(context)
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'No active organization found for website settings' },
        { status: 403 }
      )
    }

    // Upsert manual por (organization_id, key): evita depender del ON CONFLICT
    // (que rompe si la unicidad real es compuesta) y respeta el modelo
    // multi-tenant — una fila de settings por organización.
    const adminSupabase = createAdminSupabase()

    const existingQuery = adminSupabase
      .from('website_settings')
      .select('key, value')
      .eq('key', key)
      .eq('organization_id', orgId)
    const { data: existingRow, error: existingError } = await existingQuery.maybeSingle()

    if (existingError) {
      throw existingError
    }

    const writePayload = {
      value,
      updated_by: context.user.id,
      updated_at: new Date().toISOString(),
    }

    const { data: persistedRow, error } = await adminSupabase
      .from('website_settings')
      .upsert(
        { key, organization_id: orgId, ...writePayload },
        { onConflict: 'organization_id,key' }
      )
      .select('value')
      .single()

    if (error) {
      console.error('Failed to update website setting', { 
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
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
        organization_id: orgId,
        user_id: context.user.id,
        action: 'update_website_setting',
        resource: 'website_settings',
        resource_id: key,
        old_values: { value: existingRow?.value },
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
      data: persistedRow.value,
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
      {
        success: false,
        error: 'Failed to update setting',
        // Admin-only route: surface the real cause to unblock diagnosis.
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  return withAdminAuth((req, authContext) => 
    handler(req, { 
      params: context.params, 
      user: authContext.user,
      organizationId: authContext.organizationId 
    })
  )(request)
}
