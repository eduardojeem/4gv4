import { createServerClient } from '@supabase/ssr'
import { AuthError } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { isMfaPending, MFA_REQUIRED_AUTH_ERROR, readTokenAal } from '@/lib/auth/mfa'

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

  // Sin cookies (la app) no hay sesión guardada y `getUser()` respondería «sin
  // sesión»: se le pasa el token del header. Con 2FA activa y una sesión que
  // todavía no pasó el código (`aal1`), responde «sin usuario». Las rutas lo
  // llaman sin argumentos, así que todas exigen las dos cosas sin tocarlas una
  // por una. Supabase valida el token igual.
  const getUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = async (jwt?: string) => {
    // `getSession()` lee la cookie y la renueva si venció; el token lo valida `getUser`.
    const token = jwt ?? bearer ?? (await client.auth.getSession()).data.session?.access_token
    const result = await getUser(token ?? undefined)
    if (result.data.user && isMfaPending(result.data.user, readTokenAal(token))) {
      return {
        data: { user: null },
        error: new AuthError('Falta la verificación en dos pasos', 401, MFA_REQUIRED_AUTH_ERROR),
      }
    }
    return result
  }

  return client
}
