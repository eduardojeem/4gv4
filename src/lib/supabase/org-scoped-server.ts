import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente de Supabase que le dice a la base en qué organización se está
 * trabajando.
 *
 * Las políticas de RLS de puntos y sorteos comparan contra
 * `public.current_organization_id()`. Esa función resuelve la organización
 * sola **solo si el usuario pertenece a una**; si pertenece a varias, necesita
 * el header `x-organization-id` y sin él devuelve NULL — con lo cual toda
 * política que la use rechaza, incluso a un administrador.
 *
 * En esta base 6 de 17 usuarios pertenecen a más de una organización, así que
 * no es un caso de borde: usar `createClient()` pelado los dejaba a todos sin
 * poder leer ni escribir, con un 403 imposible de explicar.
 *
 * El header no es una vía para hacerse pasar por otra organización:
 * `current_organization_id()` solo lo acepta después de comprobar que quien
 * hace el pedido es miembro activo de esa organización. Aun así, este helper
 * debe recibir el id que ya resolvió y validó `withTenantAuth`, nunca uno que
 * venga del cuerpo o de la query del pedido.
 */
export async function createOrgScopedClient(organizationId: string) {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { 'x-organization-id': organizationId },
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Llamado desde un Server Component: lo refresca el middleware.
          }
        },
      },
    }
  )
}
