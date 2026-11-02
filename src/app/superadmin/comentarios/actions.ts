'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { FEEDBACK_STATUSES, setFeedbackStatus } from '@/lib/feedback/user-feedback'

const schema = z.object({ id: z.string().uuid(), status: z.enum(FEEDBACK_STATUSES) })

export async function setFeedbackStatusAction(id: string, status: string) {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false as const, error: 'Acceso denegado' }
  const parsed = schema.safeParse({ id, status })
  if (!parsed.success) return { ok: false as const, error: 'Datos inválidos' }
  try {
    await setFeedbackStatus(parsed.data.id, parsed.data.status)
  } catch {
    return { ok: false as const, error: 'No se pudo actualizar el comentario' }
  }
  revalidatePath('/superadmin/comentarios')
  return { ok: true as const }
}
