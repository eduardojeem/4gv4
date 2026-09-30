'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { expenseInputSchema, type PlatformExpense } from '@/lib/superadmin/platform-finance'
import {
  deletePlatformExpense,
  insertPlatformExpense,
  updatePlatformExpense,
} from '@/lib/superadmin/platform-expenses'

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

const idSchema = z.string().uuid()
const PATH = '/superadmin/finanzas'
const RESOURCE = 'platform_expenses'

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Error inesperado'
}

function parseInput(raw: unknown) {
  const parsed = expenseInputSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' } as const
  return { data: parsed.data } as const
}

export async function createExpenseAction(raw: unknown): Promise<ActionResult<PlatformExpense>> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }
  const input = parseInput(raw)
  if ('error' in input) return { ok: false, error: input.error }

  try {
    const expense = await insertPlatformExpense(input.data, user.id)
    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'create',
      resource: RESOURCE,
      resourceId: expense.id,
      newValues: { ...expense },
      severity: 'low',
    })
    revalidatePath(PATH)
    return { ok: true, data: expense }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

export async function updateExpenseAction(id: string, raw: unknown): Promise<ActionResult<PlatformExpense>> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }
  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Gasto inválido' }
  const input = parseInput(raw)
  if ('error' in input) return { ok: false, error: input.error }

  try {
    const { before, after } = await updatePlatformExpense(id, input.data)
    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'update',
      resource: RESOURCE,
      resourceId: id,
      oldValues: { ...before },
      newValues: { ...after },
      severity: 'low',
    })
    revalidatePath(PATH)
    return { ok: true, data: after }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }
  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Gasto inválido' }

  try {
    const deleted = await deletePlatformExpense(id)
    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'delete',
      resource: RESOURCE,
      resourceId: id,
      oldValues: { ...deleted },
      severity: 'medium',
    })
    revalidatePath(PATH)
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}
