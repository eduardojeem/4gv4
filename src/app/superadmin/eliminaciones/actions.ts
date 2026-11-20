'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { AccountDeletionError, cancelAccountDeletion } from '@/lib/account/account-deletion'

const schema = z.string().uuid()

/** Cancela un pedido de eliminación pendiente: la cuenta y sus negocios vuelven a como estaban. */
export async function cancelAccountDeletionAction(requestId: string) {
  const me = await getSuperAdminUser()
  if (!me) return { ok: false as const, error: 'Acceso denegado' }
  const parsed = schema.safeParse(requestId)
  if (!parsed.success) return { ok: false as const, error: 'Pedido inválido' }
  try {
    const { userId } = await cancelAccountDeletion(parsed.data, me.id)
    await logSuperAdminAction({
      actorId: me.id,
      actorEmail: me.email,
      action: 'cancel_account_deletion',
      resource: 'account_deletion_requests',
      resourceId: parsed.data,
      newValues: { userId, status: 'cancelled' },
      severity: 'high',
    })
  } catch (error) {
    return { ok: false as const, error: error instanceof AccountDeletionError ? error.message : 'No se pudo cancelar el pedido' }
  }
  revalidatePath('/superadmin/eliminaciones')
  return { ok: true as const }
}
