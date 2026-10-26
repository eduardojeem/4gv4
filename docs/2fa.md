# Verificación en dos pasos (2FA)

Cada usuario puede activar un código de una app autenticadora (Google Authenticator,
Microsoft Authenticator, 1Password…) desde **Perfil → Seguridad → Verificación en dos
pasos**: QR y clave para cargarla, el primer código para confirmarla, la lista de apps
cargadas y el botón para desactivarla.

Con 2FA activa, después de la contraseña o la passkey se pide el código:

- **Web**: `/auth/mfa` (`src/app/auth/mfa`). El login, los logins de clientes y el
  restablecimiento de contraseña mandan ahí; el proxy también, desde cualquier página
  privada, mientras la sesión no haya pasado el código.
- **App**: `sign-in` muestra el paso del código (`mobile/src/components/mfa-code-card.tsx`).
  Mientras falte, la sesión no se le da a la navegación.

## Cómo está hecho

Se usa el **MFA nativo de Supabase Auth** (TOTP): `mfa.enroll`, `challengeAndVerify`,
`unenroll`, `listFactors` y `getAuthenticatorAssuranceLevel`, siempre con la sesión del
usuario (sin service_role ni tablas propias). Supabase marca cada token con `aal`:
`aal1` = sólo contraseña o passkey, `aal2` = pasó el código. Supabase ya exige `aal2`
para borrar una app verificada y para cambiar la contraseña.

La regla vive en `src/lib/auth/mfa.ts` (y su copia en `mobile/src/lib/mfa-model.ts`):
**con un factor verificado, la sesión tiene que ser `aal2`**.

| Dónde | Qué hace |
| --- | --- |
| `src/proxy.ts` | Redirige `/dashboard`, `/admin`, `/superadmin`, internas y `/login` a `/auth/mfa?redirect=…`. |
| `src/lib/supabase/server.ts` | `auth.getUser()` responde «sin usuario» (`AuthError` `mfa_required`) con sesión `aal1`: todas las APIs que lo usan devuelven 401. |
| `requireAuth` / `withTenantAuth` | 401 con `code: 'MFA_REQUIRED'`. |
| App (`mobile/src/lib/api.ts`) | Un 401 `MFA_REQUIRED` no cierra la sesión. |

## Exigir 2FA a los administradores

En **/admin/settings** (Configuración, fuera de las pestañas; no depende del plan, a
diferencia de /admin/security) el dueño o un administrador (`settings.manage`) puede activar
«Exigir verificación en dos pasos a los administradores». Se guarda en
`organization_settings.require_admin_mfa` (migración
`20261025160000_organization_require_admin_mfa.sql`).

- Sólo se puede cambiar con una sesión `aal2`: lo verifican la API
  (`/api/admin/security/mfa-policy`) y un trigger en la base.
- Con la opción activa, owner/admin sin `aal2` van a `/auth/mfa?setup=1` desde el panel,
  reciben 403 `MFA_ENROLLMENT_REQUIRED` en las APIs de la organización y la app no les
  da sesión hasta que la activen en la web.
- El valor se cachea un minuto por instancia; ante un error de la consulta no se exige.

## Límites conocidos

- **La exigencia de `aal2` es de la aplicación**, no de RLS. Con sólo la contraseña se
  puede obtener un token `aal1` y consultar la API de datos de Supabase directamente.
  Cerrarlo requiere políticas RLS `RESTRICTIVE` por tabla que comparen
  `auth.jwt()->>'aal'` (endurecen RLS, pero cambian RLS en producción: queda pendiente).
- **Sin códigos de recuperación**: los de Supabase todavía son experimentales. Si alguien
  pierde el teléfono, soporte borra su factor desde el dashboard de Supabase
  (Authentication → Users → el usuario → MFA) o con `auth.admin.mfa.deleteFactor`.
- En el proyecto hosteado, TOTP viene habilitado por defecto
  (Authentication → Multi-Factor). Verificarlo antes de anunciarlo.
- En el stack local, `supabase/config.toml` habilita `[auth.mfa.totp]`. Un stack que ya
  existía (por ejemplo el aislado de `scripts/mobile-dev-supabase.mjs`, que copia la
  config una sola vez a `%LOCALAPPDATA%\MiTiendaPy\mobile-dev-supabase`) necesita esa
  sección agregada a mano y reiniciarse; si no, el perfil avisa «no está habilitada en el
  sistema todavía».
