export interface NormalizedSupabaseError {
  name?: string
  message: string
  stack?: string
  code?: string
  details?: string
  hint?: string
  status?: number
}

export function normalizeSupabaseError(err: unknown): NormalizedSupabaseError {
  if (!err) {
    return { message: 'Unknown error' }
  }

  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    }
  }

  if (typeof err === 'object') {
    const error = err as Record<string, unknown>

    return {
      message: String(error.message ?? 'Unknown error'),
      code: error.code == null ? undefined : String(error.code),
      details: error.details == null ? undefined : String(error.details),
      hint: error.hint == null ? undefined : String(error.hint),
      status: error.status == null ? undefined : Number(error.status),
    }
  }

  return { message: String(err) }
}
