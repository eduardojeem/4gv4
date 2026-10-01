import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getClientIp, rateLimiter } from '@/lib/rate-limiter'
import { parseClientErrorPayload } from '@/lib/logging/client-error-payload'
import { recordServerError } from '@/lib/logging/error-reporter'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req)
    if (!(await rateLimiter.check(`system-error:${clientIp}`, 10, 60_000))) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > 16_384) {
      return NextResponse.json({ success: false, error: 'Payload too large' }, { status: 413 })
    }

    const rawBody = await req.text()
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
      return NextResponse.json({ success: false, error: 'Payload too large' }, { status: 413 })
    }
    const payload = parseClientErrorPayload(JSON.parse(rawBody))
    const auth = await resolveRequestAuthUser()
    const userId = auth.authenticated ? auth.user.id : null
    let organizationId: string | null = null
    if (userId) {
      const { data } = await createAdminSupabase()
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .limit(2)
      // Sin un contexto de organización firmado, no elegimos arbitrariamente
      // entre varias membresías: evitamos atribuir el error al tenant equivocado.
      organizationId = data?.length === 1 ? data[0].organization_id : null
    }

    await recordServerError({
      ...payload,
      userId,
      organizationId,
      userAgent: req.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
    }
    return NextResponse.json({ success: false }, { status: 400 })
  }
}
