import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import {
  ACCOUNT_DELETION_CONFIRM_WORD,
  AccountDeletionError,
  getAccountDeletionImpact,
  requestAccountDeletion,
} from '@/lib/account/account-deletion'

const deleteSchema = z.object({
  password: z.string().min(1, 'Ingresá tu contraseña.').max(200),
  confirm: z.string().trim(),
  reason: z.string().trim().max(500).optional(),
  source: z.enum(['app', 'web']).default('web'),
}).strict()

async function authenticatedUser() {
  const auth = await resolveRequestAuthUser()
  if ('reason' in auth) return null
  return auth.user
}

/** Qué pasa si se elimina la cuenta (negocios que se cierran, pedido pendiente). */
export async function GET() {
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Iniciá sesión para eliminar tu cuenta.' }, { status: 401 })
  return NextResponse.json(await getAccountDeletionImpact(user.id, user.email ?? null))
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Iniciá sesión para eliminar tu cuenta.' }, { status: 401 })
  if (user.role === 'super_admin') {
    return NextResponse.json({ error: 'Una cuenta de superadmin no se puede eliminar desde acá.' }, { status: 403 })
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos.' }, { status: 400 })
  if (parsed.data.confirm.toUpperCase() !== ACCOUNT_DELETION_CONFIRM_WORD) {
    return NextResponse.json({ error: `Escribí ${ACCOUNT_DELETION_CONFIRM_WORD} para confirmar.` }, { status: 400 })
  }

  try {
    const result = await requestAccountDeletion({
      userId: user.id,
      email: user.email ?? null,
      password: parsed.data.password,
      source: parsed.data.source,
      reason: parsed.data.reason,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof AccountDeletionError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[account-delete] Falló el pedido de eliminación', { userId: user.id, error })
    return NextResponse.json({ error: 'No se pudo registrar el pedido. Probá de nuevo.' }, { status: 500 })
  }
}
