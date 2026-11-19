import { NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { AccountDeletionError, sendAccountDeletionCode } from '@/lib/account/account-deletion'

/** Manda al correo de la cuenta el código para confirmar la eliminación (cuentas sin contraseña). */
export async function POST() {
  const auth = await resolveRequestAuthUser()
  if ('reason' in auth) return NextResponse.json({ error: 'Iniciá sesión para eliminar tu cuenta.' }, { status: 401 })
  if (auth.user.role === 'super_admin') {
    return NextResponse.json({ error: 'Una cuenta de superadmin no se puede eliminar desde acá.' }, { status: 403 })
  }

  try {
    const result = await sendAccountDeletionCode({ userId: auth.user.id, email: auth.user.email ?? null })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof AccountDeletionError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[account-delete] No se pudo mandar el código', { userId: auth.user.id, error })
    return NextResponse.json({ error: 'No se pudo mandar el código. Probá de nuevo.' }, { status: 500 })
  }
}
