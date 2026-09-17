import { z } from 'zod'
import { PERMISSIONS } from '@/lib/auth/roles-permissions'
import { isKnownManagedUserRole } from '@/lib/auth/organization-owner-policy'

/**
 * Lo que se puede cambiar al editar un usuario.
 *
 * El servidor guardaba el nombre, el teléfono y el departamento tal como
 * llegaban: sin largo máximo, y un rol desconocido caía en «cliente» sin avisar,
 * así que un error de escritura podía dejar sin acceso a alguien del equipo.
 * Las mismas reglas corren en el formulario y en la API.
 */

export const USER_ROLES = ['super_admin', 'admin', 'vendedor', 'tecnico', 'cliente'] as const
export const USER_STATUSES = ['active', 'inactive', 'suspended'] as const

export type UserRoleValue = (typeof USER_ROLES)[number]

/** Los permisos que existen: no se guarda uno inventado. */
export const KNOWN_PERMISSIONS: ReadonlySet<string> = new Set(Object.values(PERMISSIONS).map((permission) => permission.id))

const LETTER = /\p{L}/u
/** Números, espacios y los signos de un teléfono: `+`, `-`, `(`, `)`. */
const PHONE_SHAPE = /^[\d\s+()-]+$/

export const userNameSchema = z.string()
  .trim()
  .min(2, 'El nombre necesita al menos 2 caracteres')
  .max(120, 'El nombre no puede pasar de 120 caracteres')
  .refine((value) => LETTER.test(value), 'El nombre tiene que tener letras')

export const userPhoneSchema = z.string()
  .trim()
  .max(30, 'El teléfono no puede pasar de 30 caracteres')
  .refine((value) => !value || PHONE_SHAPE.test(value), 'El teléfono solo puede tener números y los signos + - ( )')
  .refine((value) => !value || value.replace(/\D/g, '').length >= 6, 'El teléfono necesita al menos 6 números')

export const userDepartmentSchema = z.string()
  .trim()
  .max(60, 'El área no puede pasar de 60 caracteres')

export const userPermissionsSchema = z.array(z.string())
  .max(80, 'Demasiados permisos')
  .refine((list) => list.every((permission) => KNOWN_PERMISSIONS.has(permission)), 'Hay un permiso que no existe')

/** Lo que manda el formulario de edición. Todo es opcional: se guarda lo que vino. */
export const userEditSchema = z.object({
  name: userNameSchema.optional(),
  phone: userPhoneSchema.optional().or(z.literal('')),
  department: userDepartmentSchema.optional().or(z.literal('')),
  // En la API se aceptan tambien los nombres viejos («customer», «seller») y
  // «owner», que tiene su propio aviso: solo se cambia por transferencia.
  role: z.string().trim().refine(isKnownManagedUserRole, 'Ese rol no existe').optional(),
  // «invited» llega desde las invitaciones y el servidor lo trata como inactivo.
  status: z.enum([...USER_STATUSES, 'invited'], { message: 'Ese estado no existe' }).optional(),
  permissions: userPermissionsSchema.optional(),
  avatar_url: z.string().trim().max(500, 'La dirección de la foto es demasiado larga')
    .refine(
      (value) => !value || value.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(value),
      'La foto debe ser una ruta interna o una dirección http(s)',
    )
    .optional()
    .or(z.literal('')),
})

export type UserEditInput = z.infer<typeof userEditSchema>

/** El primer problema, en castellano, para mostrarlo tal cual. */
export function firstUserEditIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  return issue?.message || 'Revisá los datos'
}
