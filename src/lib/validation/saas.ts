import { z } from 'zod'
import { slugifyTenantName } from '@/lib/saas/tenant'
import { validatePassword } from '@/lib/auth/password-validation'

const planTiers = ['free', 'basic', 'pro', 'enterprise'] as const

export const registerCompanySchema = z.object({
  fullName: z.string().trim().min(2, 'El nombre completo es requerido').max(120),
  email: z.string().trim().email('Correo electronico invalido').max(254),
  password: z.string().min(1, 'La contrasena es requerida').refine((value) => !validatePassword(value), {
    message: 'La contrasena no cumple los requisitos de seguridad',
  }),
  companyName: z.string().trim().min(2, 'El nombre de la empresa es requerido').max(120),
  companySlug: z.string().trim().max(64).optional(),
  plan: z.enum(planTiers).optional().default('free'),
}).transform((value) => ({
  ...value,
  companySlug: slugifyTenantName(value.companySlug || value.companyName),
  selectedPlan: value.plan.toUpperCase() as 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE',
}))

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>
