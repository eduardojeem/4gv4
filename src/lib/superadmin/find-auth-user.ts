import type { SupabaseClient } from '@supabase/supabase-js'

type AdminClient = Pick<SupabaseClient, 'from' | 'auth'>

export interface AuthUserLookup {
  id: string
  email: string | null
}

/** Cuantas paginas de 200 se recorren cuando hay que caer al barrido. */
const SCAN_PAGES = 25

/**
 * Busca un usuario por correo sin el techo de 1.000 que tenia la pantalla.
 *
 * La version anterior recorria como maximo cinco paginas de 200 usuarios de
 * `auth.users`. Pasado ese numero, promover a alguien devolvia «No existe un
 * usuario con email X» — una afirmacion falsa sobre algo que si existe. Y en el
 * listado, el mismo techo dejaba el ultimo acceso en `null`, que la pantalla
 * pinta como «Nunca»: un superadmin que entro hoy figuraba como que nunca
 * entro.
 *
 * `profiles` tiene el correo y es una tabla normal: se consulta directo y sin
 * limite. El barrido queda solo como respaldo para el caso de un usuario que
 * exista en `auth.users` y todavia no tenga perfil.
 */
export async function findAuthUserByEmail(
  admin: AdminClient,
  rawEmail: string
): Promise<{ user: AuthUserLookup | null; scanTruncated: boolean }> {
  const email = rawEmail.trim().toLowerCase()
  if (!email) return { user: null, scanTruncated: false }

  const { data: profile } = await admin
    .from('profiles')
    .select('id, email')
    .ilike('email', email)
    .maybeSingle()

  if (profile?.id) {
    return { user: { id: profile.id, email: profile.email ?? email }, scanTruncated: false }
  }

  // Sin perfil: puede existir en `auth.users` de todas formas.
  for (let page = 1; page <= SCAN_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)

    const users = (data?.users ?? []) as Array<{ id: string; email?: string | null }>
    const match = users.find((candidate) => candidate.email?.toLowerCase() === email)
    if (match) return { user: { id: match.id, email: match.email ?? email }, scanTruncated: false }

    // Ultima pagina: se recorrio todo y no esta.
    if (users.length < 200) return { user: null, scanTruncated: false }
  }

  // Se agoto el barrido sin encontrarlo: no se puede afirmar que no exista.
  return { user: null, scanTruncated: true }
}

/**
 * Ultimo acceso de un conjunto acotado de usuarios, uno por uno.
 *
 * Son un puñado —los superadmins—, asi que preguntar por cada uno es exacto y
 * no depende de cuantos usuarios tenga la plataforma.
 */
export async function getLastSignIns(
  admin: AdminClient,
  userIds: string[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>()

  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(userId)
        if (error || !data?.user) {
          result.set(userId, null)
          return
        }
        result.set(userId, data.user.last_sign_in_at ?? null)
      } catch {
        result.set(userId, null)
      }
    })
  )

  return result
}
