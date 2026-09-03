import { z } from 'zod'
import { slugifyTenantName } from '@/lib/saas/tenant'
import { validatePassword } from '@/lib/auth/password-validation'
import { captchaTokenSchema } from '@/lib/auth/captcha'

export const registerCompanySchema = z.object({
  fullName: z.string().trim().min(2, 'El nombre completo es requerido').max(120),
  email: z.string().trim().email('Correo electronico invalido').max(254),
  password: z.string().min(1, 'La contrasena es requerida').refine((value) => !validatePassword(value), {
    message: 'La contrasena no cumple los requisitos de seguridad',
  }),
  companyName: z.string().trim().min(2, 'El nombre de la empresa es requerido').max(120),
  companySlug: z.string().trim().max(64).optional(),
  // El plan es obligatorio y se valida contra la base, no contra una lista fija.
  //
  // Antes era `z.enum(['free','basic','pro','enterprise']).default('free')`, con
  // dos consecuencias: un plan creado desde el panel con otro tier no se podia
  // elegir —el registro caia al default sin avisar— y quien llegaba sin plan
  // quedaba inscripto en el tier `free`, que en esta plataforma es un plan PAGO.
  // Aca solo se comprueba el formato; que exista y este activo lo decide la fila.
  plan: z.string()
    .trim()
    .toLowerCase()
    .min(1, 'Elegí un plan para continuar')
    .max(48)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Plan invalido'),
  captchaToken: captchaTokenSchema,
}).transform((value) => ({
  ...value,
  companySlug: slugifyTenantName(value.companySlug || value.companyName),
  selectedPlan: value.plan.toUpperCase(),
}))

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>
