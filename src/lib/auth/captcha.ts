import { z } from 'zod'

export const captchaTokenSchema = z
  .string({ error: 'Completa la verificacion de seguridad.' })
  .trim()
  .min(1, 'Completa la verificacion de seguridad.')
  .max(4096, 'La verificacion de seguridad no es valida.')
