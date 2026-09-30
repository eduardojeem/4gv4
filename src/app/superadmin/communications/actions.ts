'use server'

import { z } from 'zod'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { getMessageContent } from '@/lib/superadmin/communications'

export async function getMessageContentAction(id: string) {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false as const, error: 'Acceso denegado' }
  if (!z.string().min(1).max(100).safeParse(id).success) return { ok: false as const, error: 'Mensaje inválido' }
  const content = await getMessageContent(id)
  if (!content) return { ok: false as const, error: 'No se encontró el mensaje' }
  return { ok: true as const, data: content }
}
