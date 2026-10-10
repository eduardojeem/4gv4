import { z } from 'zod'

export const AgendaServiceCreateSchema = z.object({
  requestKey: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  price: z.number().finite().min(0).max(99999999.99).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001),
  durationMinutes: z.number().int().min(5).max(600),
  catalogVisible: z.boolean(),
  online: z.boolean(),
}).strict()
export type AgendaServiceCreateInput = z.infer<typeof AgendaServiceCreateSchema>
export type AgendaServiceCreateResult = { success: true; service: { id: string }; replayed: boolean }
export class AgendaServiceCreateError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'AgendaServiceCreateError' }
}
// These responses prove that no write committed. Network/unknown failures do
// not, so those keep the exact input and key for a safe retry.
export function serviceCreationDefinitelyRejected(error: unknown): boolean {
  return error instanceof AgendaServiceCreateError && ['SERVICE_BUSY', 'INVALID_SERVICE', 'SERVICE_LIMIT_REACHED', 'SERVICE_POLICY_CHANGED', 'ACTOR_NOT_AUTHORIZED', 'INVENTORY_REQUIRED', 'SUBSCRIPTION_BLOCKED', 'SERVICE_MIGRATION_REQUIRED', 'MODULE_DISABLED', 'MODULE_NOT_ENTITLED'].includes(error.code)
}
export async function createAgendaService(input: AgendaServiceCreateInput): Promise<AgendaServiceCreateResult> {
  const response = await fetch('/api/agenda/services', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.success !== true || typeof result?.service?.id !== 'string') {
    throw new AgendaServiceCreateError(result?.error || 'No se pudo confirmar el alta. Reintentá con los mismos datos.', result?.code || 'SERVICE_CREATE_FAILED')
  }
  return result
}
