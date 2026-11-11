/**
 * Políticas globales de la plataforma que se guardan en `system_settings`
 * (id='system') y que la app aplica de verdad:
 *
 * - `maintenanceMode`: el panel de las tiendas y las páginas públicas muestran
 *   /mantenimiento. El superadmin, el login, la API y la app siguen andando.
 * - `allowRegistration`: con `false`, el alta de empresas se rechaza.
 * - `requireTwoFactor`: exige 2FA a los administradores de todas las tiendas
 *   (lo mismo que cada tienda puede exigir desde Seguridad).
 * - `passwordMinLength`: largo mínimo de la contraseña al registrarse.
 *
 * Se consulta en el proxy en muchos pedidos, así que el valor se guarda 30
 * segundos por instancia. Ante un error se usan los valores seguros por
 * defecto (sin mantenimiento, registro abierto): un fallo de la consulta no
 * deja a todos afuera.
 */

export type PlatformPolicies = {
  maintenanceMode: boolean
  allowRegistration: boolean
  requireTwoFactor: boolean
  passwordMinLength: number
}

export const DEFAULT_PLATFORM_POLICIES: PlatformPolicies = {
  maintenanceMode: false,
  allowRegistration: true,
  requireTwoFactor: false,
  passwordMinLength: 8,
}

/** Límites del largo mínimo: debajo de 8 es inseguro; 32 es el tope de la base. */
export const PASSWORD_MIN_LENGTH_RANGE = { min: 8, max: 32 } as const

export const PLATFORM_POLICY_COLUMNS = 'maintenance_mode, allow_registration, require_two_factor, password_min_length'

const TTL_MS = 30_000
let cached: { value: PlatformPolicies; expiresAt: number } | null = null

type PolicyRow = {
  maintenance_mode?: boolean | null
  allow_registration?: boolean | null
  require_two_factor?: boolean | null
  password_min_length?: number | string | null
}

export function toPlatformPolicies(row: PolicyRow | null | undefined): PlatformPolicies {
  if (!row) return { ...DEFAULT_PLATFORM_POLICIES }
  const length = Number(row.password_min_length)
  return {
    maintenanceMode: row.maintenance_mode === true,
    allowRegistration: row.allow_registration !== false,
    requireTwoFactor: row.require_two_factor === true,
    passwordMinLength: Number.isFinite(length)
      ? Math.min(PASSWORD_MIN_LENGTH_RANGE.max, Math.max(PASSWORD_MIN_LENGTH_RANGE.min, Math.round(length)))
      : DEFAULT_PLATFORM_POLICIES.passwordMinLength,
  }
}

/** Cualquier cliente con permiso de lectura sobre `system_settings` (el de servicio). */
export type PlatformPolicyClient = {
  from: (table: 'system_settings') => {
    select: (columns: string) => {
      eq: (column: 'id', value: 'system') => {
        maybeSingle: () => PromiseLike<{ data: PolicyRow | null; error: unknown }>
      }
    }
  }
}

export async function loadPlatformPolicies(client: PlatformPolicyClient, now = Date.now()): Promise<PlatformPolicies> {
  if (cached && cached.expiresAt > now) return cached.value
  try {
    const { data, error } = await client.from('system_settings').select(PLATFORM_POLICY_COLUMNS).eq('id', 'system').maybeSingle()
    // Un error no se guarda: dejaría el valor por defecto todo el período por un fallo puntual.
    if (error) return { ...DEFAULT_PLATFORM_POLICIES }
    const value = toPlatformPolicies(data)
    cached = { value, expiresAt: now + TTL_MS }
    return value
  } catch {
    return { ...DEFAULT_PLATFORM_POLICIES }
  }
}

/** Al guardar desde el superadmin, esta instancia lo ve enseguida; las demás en a lo sumo 30 s. */
export function invalidatePlatformPolicies() {
  cached = null
}

/**
 * Rutas que siguen abiertas con la plataforma en mantenimiento: el superadmin
 * (para apagarlo), el login y la verificación en dos pasos, la API (app móvil,
 * cobros, webhooks y tareas programadas) y la propia página de mantenimiento.
 */
export function isMaintenanceExempt(pathname: string): boolean {
  return pathname === '/mantenimiento'
    || pathname === '/login'
    || pathname.startsWith('/superadmin')
    || pathname.startsWith('/auth')
    || pathname.startsWith('/api/')
    || pathname.startsWith('/_next')
    || pathname === '/robots.txt'
    || pathname === '/sitemap.xml'
    || pathname === '/manifest.webmanifest'
}
