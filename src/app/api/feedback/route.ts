import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { FeedbackError, feedbackSchema, submitUserFeedback } from '@/lib/feedback/user-feedback'

/** «Enviar comentarios» del header (web) y del menú del avatar (app). */
export async function POST(request: NextRequest) {
  const auth = await resolveRequestAuthUser()
  if ('reason' in auth) return NextResponse.json({ error: 'Iniciá sesión para enviar comentarios.' }, { status: 401 })

  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos.' }, { status: 400 })

  try {
    const organization = await getCurrentOrganizationContext(auth.user.id).catch(() => null)
    const result = await submitUserFeedback({
      ...parsed.data,
      userId: auth.user.id,
      email: auth.user.email ?? null,
      organizationId: organization?.id ?? null,
      organizationName: organization?.name ?? null,
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json({ success: true, id: result.id })
  } catch (error) {
    if (error instanceof FeedbackError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[feedback] Falló el envío', { userId: auth.user.id, error })
    return NextResponse.json({ error: 'No se pudo enviar el comentario. Probá de nuevo.' }, { status: 500 })
  }
}
