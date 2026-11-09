import { z } from 'zod'
import { slugifyTenantName } from '@/lib/saas/tenant'
import { validatePassword } from '@/lib/auth/password-validation'
import { captchaTokenSchema } from '@/lib/auth/captcha'
import { BUSINESS_VERTICALS } from '@/lib/organization/business-profile'

export const registerCompanySchema = z.object({
  fullName: z.string({ error: 'Ingresá tu nombre completo.' }).trim().min(2, 'El nombre completo es requerido').max(120, 'El nombre completo no puede superar 120 caracteres.'),
  email: z.string({ error: 'Ingresá un correo electrónico válido.' }).trim().email('Correo electrónico inválido').max(254, 'El correo no puede superar 254 caracteres.'),
  password: z.string({ error: 'Ingresá una contraseña.' }).min(1, 'La contrasena es requerida').refine((value) => !validatePassword(value), {
    message: 'La contrasena no cumple los requisitos de seguridad',
  }),
  companyName: z.string({ error: 'Ingresá el nombre de la empresa.' }).trim().min(2, 'El nombre de la empresa es requerido').max(120, 'El nombre de la empresa no puede superar 120 caracteres.'),
  companySlug: z.string({ error: 'Ingresá una dirección válida para tu empresa.' }).trim().max(64, 'La dirección de la empresa no puede superar 64 caracteres.').optional(),
  // El plan es obligatorio y se valida contra la base, no contra una lista fija.
  //
  // Antes era `z.enum(['free','basic','pro','enterprise']).default('free')`, con
  // dos consecuencias: un plan creado desde el panel con otro tier no se podia
  // elegir —el registro caia al default sin avisar— y quien llegaba sin plan
  // quedaba inscripto en el tier `free`, que en esta plataforma es un plan PAGO.
  // Aca solo se comprueba el formato; que exista y este activo lo decide la fila.
  plan: z.string({ error: 'Elegí un plan para continuar.' })
    .trim()
    .toLowerCase()
    .min(1, 'Elegí un plan para continuar')
    .max(48, 'El identificador del plan no puede superar 48 caracteres.')
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Plan invalido'),
  captchaToken: captchaTokenSchema,
  // Opcional para no romper integraciones que ya llaman a la API. Con el rubro
  // desde el alta, la tienda arranca con sus categorías y sus textos, en vez de
  // quedar como «general» hasta terminar la configuración.
  businessVertical: z.enum(BUSINESS_VERTICALS, { error: 'Elegí un rubro válido.' }).optional(),
}).transform((value) => ({
  ...value,
  companySlug: slugifyTenantName(value.companySlug || value.companyName),
  selectedPlan: value.plan.toUpperCase(),
}))

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>
