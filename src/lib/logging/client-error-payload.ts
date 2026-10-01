import { z } from 'zod'

const metadataSchema = z.record(z.string(), z.unknown()).refine(
  (value) => {
    try {
      return JSON.stringify(value).length <= 4_000
    } catch {
      return false
    }
  },
  'metadata demasiado grande o no serializable',
)

const clientErrorSchema = z.object({
  name: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(2_000),
  stack: z.string().max(5_000).nullish().transform((value) => value ?? null),
  digest: z.string().max(200).nullish().transform((value) => value ?? null),
  url: z.string().max(500).nullish().transform((value) => value ?? null),
  source: z.enum(['client', 'boundary']).default('client'),
  severity: z.enum(['error', 'fatal', 'warn']).default('error'),
  metadata: metadataSchema.default({}),
})

export type ClientErrorPayload = z.output<typeof clientErrorSchema>

export function parseClientErrorPayload(input: unknown): ClientErrorPayload {
  return clientErrorSchema.parse(input)
}
