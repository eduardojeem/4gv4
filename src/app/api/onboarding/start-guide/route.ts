import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { loadStartGuide, saveStartGuidePreferences } from '@/lib/onboarding/start-guide-server'

const preferencesSchema = z.object({ version: z.literal(1), teamMode: z.enum(['solo', 'team']).nullable(), postponed: z.boolean() }).strict()
function failure(error: unknown) {
  const status = error && typeof error === 'object' && 'status' in error && [403, 409].includes(Number(error.status)) ? Number(error.status) : 500
  return NextResponse.json({ error: status === 409 ? 'La organización cambió. Actualizá la guía.' : status === 403 ? 'No tenés acceso a esta guía o sucursal.' : 'No se pudo comprobar la preparación del negocio.' }, { status })
}
export async function GET(request: NextRequest) {
  const auth = await resolveRequestAuthUser()
  if ('reason' in auth) return NextResponse.json({ error: 'Sesión no disponible.' }, { status: auth.reason !== 'inactive' ? 401 : 403 })
  const branch = z.string().uuid().optional().safeParse(request.headers.get('x-branch-id') || undefined)
  if (!branch.success) return NextResponse.json({ error: 'Sucursal inválida.' }, { status: 400 })
  try {
    const result = await loadStartGuide(auth.user.id, branch.data)
    const expected = request.headers.get('x-organization-id')
    if (expected && expected !== result.organizationId) return failure({ status: 409 })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return failure(error) }
}
export async function PATCH(request: NextRequest) {
  const auth = await resolveRequestAuthUser()
  if ('reason' in auth) return NextResponse.json({ error: 'Sesión no disponible.' }, { status: auth.reason !== 'inactive' ? 401 : 403 })
  const input = preferencesSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({ error: 'Preferencias inválidas.' }, { status: 400 })
  try {
    await saveStartGuidePreferences(auth.user.id, input.data, request.headers.get('x-organization-id') || undefined)
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return failure(error) }
}
