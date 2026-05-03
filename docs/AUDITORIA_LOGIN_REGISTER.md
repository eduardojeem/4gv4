# Auditoría — Secciones `/login` y `/register`

**Fecha:** 3 de mayo de 2026  
**Archivos auditados:**
- `src/app/login/page.tsx` (página de login)
- `src/app/register/page.tsx` (página de registro)
- `src/app/auth/callback/route.ts` (callback OAuth/magic link)
- `src/app/auth/reset-password/ResetPasswordContent.tsx` (reset de contraseña)
- `src/app/api/auth/sync-role/route.ts` (sincronización de roles)
- `src/app/api/auth/assign-role/route.ts` (asignación de roles)
- `src/contexts/auth-context.tsx` (contexto de autenticación)
- `src/lib/supabase/client.ts` (cliente Supabase browser)
- `src/lib/config.ts` (configuración centralizada)
- `middleware.ts` (protección de rutas)

---

## 1. Resumen general

El sistema de autenticación usa **Supabase Auth** con email/password. El flujo es:

1. **Registro**: El usuario crea cuenta con nombre, email y contraseña. Supabase envía email de confirmación. El rol se asigna como `cliente` por defecto.
2. **Login**: Email + contraseña via `signInWithPassword`. Se logean intentos exitosos y fallidos via RPC `log_auth_event`.
3. **Callback**: `/auth/callback` intercambia el código OAuth por sesión y redirige.
4. **Reset**: Dialog en login envía email de reset. `/auth/reset-password` permite cambiar la contraseña.
5. **Middleware**: Protege rutas `/admin/*` y `/perfil/creditos/*`. Usa `getUser()` (valida JWT contra Supabase).

**Estado de compilación:** ✅ Sin errores de TypeScript ni diagnósticos.

---

## 2. Hallazgos

### 🔴 Críticos

#### 2.1 Registro envía `role: 'cliente'` en `user_metadata`
En `register/page.tsx`:
```ts
await supabase.auth.signUp({
  email: formData.email,
  password: formData.password,
  options: {
    data: {
      full_name: formData.fullName,
      role: 'cliente',
    },
  },
})
```
`user_metadata` es controlable por el usuario. Si alguien modifica el request, podría enviar `role: 'admin'`. Aunque `sync-role/route.ts` tiene protección contra esto (ignora roles privilegiados de metadata), el hecho de enviar el rol desde el cliente es un anti-patrón.

**Recomendación:** No enviar `role` en `user_metadata`. El servidor ya asigna `cliente` por defecto en `sync-role`.

#### 2.2 Login redirige siempre a `/dashboard`
```ts
router.push('/dashboard')
```
El login no respeta el parámetro `redirect` de la URL. Si el middleware redirigió al usuario a `/login?redirect=/admin/settings`, después del login el usuario va a `/dashboard` en lugar de a donde quería ir.

**Recomendación:** Leer `searchParams.get('redirect')` y redirigir ahí (con validación de que sea una ruta interna).

#### 2.3 Mensajes de error revelan existencia de cuentas
```ts
if (/email not confirmed/i.test(msg)) {
  setUnconfirmed(true)
  setError('Tu correo no esta confirmado...')
}
```
Esto confirma que el email existe en el sistema. Un atacante puede usar esto para enumerar cuentas.

**Recomendación:** Usar un mensaje genérico: "Credenciales incorrectas o cuenta no confirmada" para todos los errores de autenticación. Mantener el botón de reenvío pero sin confirmar explícitamente la existencia.

#### 2.4 Sin metadata ni `noindex` en páginas de auth
Las páginas de login y register no tienen `<title>`, `<meta description>`, ni directiva `robots: noindex`. Esto significa:
- Los buscadores pueden indexar las páginas de login/register.
- El tab del navegador muestra el título genérico de la app.

---

### 🟡 Importantes

#### 2.5 Validación de contraseña duplicada en 3 archivos
La función `validatePassword()` está copiada en:
- `src/app/register/page.tsx`
- `src/app/auth/reset-password/ResetPasswordContent.tsx`
- (Implícitamente en el checklist visual del registro)

**Recomendación:** Extraer a `src/lib/auth/password-validation.ts`.

#### 2.6 Email de empresa hardcodeado en `config.ts`
```ts
company: {
  email: 'info@4gcelulares.com',
  // ...
}
```
No usa variable de entorno, a diferencia de `phone` y `address`.

#### 2.7 Callback de auth con validación de redirect limitada
```ts
if (!next.startsWith('/') || next.startsWith('//')) {
  next = '/dashboard'
}
```
Esta validación es básica. Variantes como `/\evil.com` o URLs con caracteres especiales podrían bypassearla en algunos navegadores.

**Recomendación:** Parsear con `new URL()` y validar que el hostname sea el mismo que el de la app.

#### 2.8 Logging de auth envía email en texto plano
```ts
await supabase.rpc('log_auth_event', {
  p_details: { email, error: msg },
})
```
El email del usuario se almacena en texto plano en los logs de auditoría. Debería hashearse como se hace en `security-audit.ts`.

#### 2.9 `rememberMe` almacenado en localStorage
```ts
localStorage.setItem('auth.rememberMe', rememberMe ? '1' : '0')
```
Esto no tiene efecto real sobre la duración de la sesión (Supabase maneja eso). Es dead code que podría confundir.

#### 2.10 Sin rate limiting en formularios de auth
No hay protección contra brute force en el lado del cliente ni del servidor (más allá de lo que Supabase provee internamente). No hay CAPTCHA en registro ni en login.

---

### 🟢 Menores / Mejoras

#### 2.11 Componentes de 300+ líneas
`LoginPage` (~300 líneas) y `RegisterPage` (~280 líneas) son monolíticos. El dialog de reset password está inline en el login.

#### 2.12 Sin `autoFocus` en el primer campo
Ninguno de los formularios tiene `autoFocus` en el primer input, lo que obliga al usuario a hacer click.

#### 2.13 Validación de email permisiva
```ts
/.+@.+\..+/.test(targetEmail)
```
Acepta emails inválidos como `a@b.c`. Debería usar una validación más estricta.

#### 2.14 Sin indicador de fuerza de contraseña visual en login
El registro tiene un checklist de requisitos, pero no hay un indicador visual de fuerza (barra de progreso).

#### 2.15 Animaciones sin `prefers-reduced-motion` completo
Se usa `useReducedMotion()` para las animaciones de framer-motion, lo que es correcto. Sin embargo, el fondo animado con gradientes CSS no se desactiva.

---

## 3. Seguridad

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Hashing de contraseñas | ✅ | Supabase usa bcrypt |
| JWT tokens | ✅ | Manejados por Supabase SSR |
| Middleware de protección | ✅ | `getUser()` valida JWT contra Supabase |
| Roles server-side | ✅ | `user_roles` es fuente de verdad, no `user_metadata` |
| Protección contra escalación | ✅ | `sync-role` ignora roles privilegiados de metadata |
| Confirmación de email | ✅ | Requerida antes de poder loguearse |
| Audit logging | ✅ | Intentos exitosos y fallidos se logean |
| Open redirect | ⚠️ | Validación básica en callback |
| Enumeración de cuentas | 🔴 | Mensajes de error revelan existencia |
| Rate limiting | ⚠️ | Solo lo que Supabase provee internamente |
| CSRF | ⚠️ | Sin tokens CSRF explícitos (Supabase maneja sesión via cookies) |
| Role en metadata | 🔴 | Se envía `role: 'cliente'` desde el cliente |

---

## 4. Accesibilidad

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Labels en inputs | ✅ | `htmlFor` + `Label` en todos los campos |
| `autoComplete` | ✅ | `email`, `current-password`, `new-password` |
| Error con `role="alert"` | ✅ | `aria-live="assertive"` en errores |
| Toggle password `aria-label` | ✅ | Labels descriptivos |
| `autoFocus` | ⚠️ | Falta en el primer campo |
| `prefers-reduced-motion` | ✅ | `useReducedMotion()` de framer-motion |
| Contraste | ✅ | Tema oscuro con buen contraste |

---

## 5. Recomendaciones priorizadas

| # | Prioridad | Acción | Estado |
|---|-----------|--------|--------|
| 1 | 🔴 Alta | No enviar `role` en `user_metadata` al registrarse | ✅ Implementado |
| 2 | 🔴 Alta | Respetar parámetro `redirect` en login (con validación) | ✅ Implementado |
| 3 | 🔴 Alta | Unificar mensajes de error para no revelar existencia de cuentas | ✅ Implementado |
| 4 | 🔴 Alta | Agregar metadata y `robots: noindex` a páginas de auth | ✅ Implementado |
| 5 | 🟡 Media | Extraer `validatePassword` a utilidad compartida | ✅ Implementado |
| 6 | 🟡 Media | Mejorar validación de redirect en auth callback | ✅ Implementado |
| 7 | 🟡 Media | No logear email en texto plano en auditoría | ✅ Implementado |
| 8 | 🟡 Media | Usar variable de entorno para email de empresa en `config.ts` | ✅ Implementado |
| 9 | 🟡 Media | Eliminar `rememberMe` en localStorage (dead code) | ✅ Implementado |
| 10 | 🟢 Baja | Agregar `autoFocus` al primer campo de cada formulario | ✅ Implementado |
| 11 | 🟢 Baja | Mejorar validación de email | ✅ Implementado |

---

## 6. Cambios implementados

### Archivos creados
- `src/lib/auth/password-validation.ts` — Funciones compartidas: `validatePassword()`, `getPasswordChecks()`, `sanitizeRedirectPath()`
- `src/app/login/layout.tsx` — Metadata con `noindex`, Suspense boundary
- `src/app/register/layout.tsx` — Metadata con `noindex`

### Archivos modificados
- `src/app/login/page.tsx` — Respeta `redirect` param, mensajes de error genéricos, no logea email, `autoFocus`, eliminado `rememberMe` localStorage
- `src/app/register/page.tsx` — No envía `role` en metadata, usa `validatePassword` compartido, `autoFocus`
- `src/app/auth/callback/route.ts` — Validación de redirect mejorada (bloquea protocol injection, backslash tricks)
- `src/app/auth/reset-password/ResetPasswordContent.tsx` — Usa `validatePassword` compartido
- `src/lib/config.ts` — Email de empresa usa variable de entorno
- `src/app/api/admin/set-role-by-email/route.ts` — Usa `isValidEmail()` compartida
- `src/components/dashboard/customer-form-simple.tsx` — Usa `isValidEmail()` compartida
