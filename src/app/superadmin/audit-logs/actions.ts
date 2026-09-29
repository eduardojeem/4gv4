'use server'

import { z } from 'zod'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { AUDIT_SOURCES, getAuditEntryDetail, type AuditSource } from '@/lib/superadmin/audit-feed'

export async function getAuditDetailAction(source: AuditSource, id: string) {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false as const, error: 'Acceso denegado' }
  if (!(AUDIT_SOURCES as readonly string[]).includes(source) || !z.string().min(1).max(100).safeParse(id).success) {
    return { ok: false as const, error: 'Registro inválido' }
  }
  const detail = await getAuditEntryDetail(source, id)
  if (!detail) return { ok: false as const, error: 'No se encontró el registro' }
  return { ok: true as const, data: detail }
}
