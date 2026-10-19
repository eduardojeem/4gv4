import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { readBoundedBody } from '@/lib/saas/bank-transfer-upload'
import { BankTransferError } from '@/lib/saas/bank-transfers'

export class TransferApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export const transferIdSchema = z.string().uuid()

export function requireTransferMutation(request: Request) {
  const origin = request.headers.get('origin')
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new TransferApiError('El origen de la solicitud no está autorizado.', 403)
  }
}

export async function readTransferJson(request: Request) {
  requireTransferMutation(request)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new TransferApiError('Enviá los datos en formato JSON.', 415)
  }
  try {
    return JSON.parse(new TextDecoder().decode(await readBoundedBody(request.body, 16 * 1024))) as unknown
  } catch {
    throw new TransferApiError('Los datos enviados no son válidos o exceden el tamaño permitido.', 400)
  }
}

export function transferJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}

export async function requireTransferTenant() {
  const auth = await resolveRequestAuthUser()
  if (auth.authenticated === false) throw new TransferApiError('No autorizado.', auth.reason === 'inactive' ? 403 : 401)
  const organization = await getCurrentOrganizationContext(auth.user.id)
  // Same organization-facing billing boundary as Pagopar and billing profile.
  if (!organization || !['owner', 'admin'].includes(organization.role)) throw new TransferApiError('No tenés permiso para gestionar pagos de planes.', 403)
  return { organization, user: auth.user }
}

export async function requireTransferSuperAdmin() {
  const [auth, superAdmin] = await Promise.all([resolveRequestAuthUser(), getSuperAdminUser()])
  if (auth.authenticated === false || !superAdmin || auth.user.id !== superAdmin.id || auth.user.role !== 'super_admin') {
    throw new TransferApiError('Sólo el superadmin puede revisar pagos de planes.', 403)
  }
  return superAdmin
}

export function transferError(error: unknown) {
  if (error instanceof TransferApiError) return transferJson({ error: error.message }, error.status)
  if (error instanceof BankTransferError) return transferJson({ error: error.message, code: error.code }, error.status)
  if (error instanceof z.ZodError) return transferJson({ error: error.issues[0]?.message || 'Los datos no son válidos.' }, 400)
  // Database details, file paths and internal exceptions never leave this boundary.
  return transferJson({ error: 'No se pudo completar la operación. Volvé a intentarlo.' }, 503)
}
