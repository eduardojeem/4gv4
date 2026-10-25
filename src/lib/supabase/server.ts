import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

/**
 * Token de la app móvil: viaja como `Authorization: Bearer <access_token>`
 * porque una app nativa no tiene las cookies de sesión de la web.
 */
export async function getRequestBearerToken(): Promise<string | null> {
  try {
    const value = (await headers()).get('authorization')
    const match = value?.match(/^Bearer\s+(.+)$/i)
    return match?.[1]?.trim() || null
  } catch {
    // Fuera de un request (scripts, build) no hay headers.
    return null
  }
}

export async function createClient() {
  const cookieStore = await cookies()
  const bearer = await getRequestBearerToken()
  const organizationId = (await headers()).get('x-organization-id')

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Con token, las consultas viajan como ese usuario y RLS aplica igual que en la web.
      global: { headers: {
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(organizationId ? { 'x-organization-id': organizationId } : {}),
      } },
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
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  if (bearer) {
    // Sin cookies no hay sesión guardada y `getUser()` respondería «sin sesión».
    // Las rutas lo llaman sin argumentos, así que se le pasa el token acá y todas
    // aceptan la app sin tocarlas una por una. Supabase valida el token igual.
    const getUser = client.auth.getUser.bind(client.auth)
    client.auth.getUser = (jwt?: string) => getUser(jwt ?? bearer)
  }

  return client
}
