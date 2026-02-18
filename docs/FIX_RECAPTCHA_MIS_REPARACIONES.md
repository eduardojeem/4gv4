# Fix: Error de Google ReCaptcha en Mis Reparaciones

**Fecha**: 15 de febrero de 2026  
**Página**: `/mis-reparaciones`  
**Estado**: ✅ Corregido

---

## Error

```
GoogleReCaptcha Context has not yet been implemented, 
if you are using useGoogleReCaptcha hook, 
make sure the hook is called inside component wrapped by GoogleRecaptchaProvider
```

**Ubicación**: `src/app/(public)/mis-reparaciones/page.tsx:34:36`

---

## Causa del Problema

El componente `MisReparacionesPage` usa el hook `useGoogleReCaptcha()` para validar el formulario de autenticación, pero el layout público no estaba envuelto en el `GoogleReCaptchaProvider`.

### Código Problemático

```tsx
// src/app/(public)/mis-reparaciones/page.tsx
export default function MisReparacionesPage() {
  const { executeRecaptcha } = useGoogleReCaptcha() // ❌ Hook sin provider
  
  const handleSubmit = async (e: React.FormEvent) => {
    // ...
    const recaptchaToken = await executeRecaptcha('repair_auth') // ❌ Error aquí
    // ...
  }
}
```

```tsx
// src/app/(public)/layout.tsx - ANTES
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main> {/* ❌ Sin RecaptchaProvider */}
      <PublicFooter />
    </div>
  )
}
```

---

## Solución Aplicada

### ✅ Agregado RecaptchaProvider al Layout Público

```tsx
// src/app/(public)/layout.tsx - AHORA
import { RecaptchaProvider } from '@/components/public/RecaptchaProvider'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <RecaptchaProvider> {/* ✅ Provider agregado */}
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="flex-1">{children}</main>
        <PublicFooter />
      </div>
    </RecaptchaProvider>
  )
}
```

---

## Cómo Funciona

### 1. RecaptchaProvider Component

```tsx
// src/components/public/RecaptchaProvider.tsx
'use client'

import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'

export function RecaptchaProvider({ children }: { children: ReactNode }) {
  const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  
  if (!recaptchaKey) {
    console.warn('reCAPTCHA site key not configured')
    return <>{children}</> // Fallback si no hay key
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={recaptchaKey}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: 'head',
      }}
    >
      {children}
    </GoogleReCaptchaProvider>
  )
}
```

### 2. Uso en la Página

```tsx
// src/app/(public)/mis-reparaciones/page.tsx
export default function MisReparacionesPage() {
  const { executeRecaptcha } = useGoogleReCaptcha() // ✅ Ahora funciona
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Verificar que executeRecaptcha esté disponible
    if (!executeRecaptcha) {
      toast.error('Error de verificación. Recarga la página.')
      return
    }

    // Ejecutar reCAPTCHA
    const recaptchaToken = await executeRecaptcha('repair_auth') // ✅ Funciona
    
    // Enviar token al servidor
    const response = await fetch('/api/public/repairs/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        recaptchaToken
      })
    })
    // ...
  }
}
```

---

## Jerarquía de Componentes

### Antes (❌ Error)
```
PublicLayout
└── div
    ├── PublicHeader
    ├── main
    │   └── MisReparacionesPage
    │       └── useGoogleReCaptcha() ❌ Sin provider
    └── PublicFooter
```

### Ahora (✅ Funciona)
```
PublicLayout
└── RecaptchaProvider ✅
    └── div
        ├── PublicHeader
        ├── main
        │   └── MisReparacionesPage
        │       └── useGoogleReCaptcha() ✅ Con provider
        └── PublicFooter
```

---

## Beneficios de la Solución

✅ **ReCaptcha funcional**: El hook `useGoogleReCaptcha()` ahora funciona correctamente  
✅ **Protección contra bots**: La página está protegida contra accesos automatizados  
✅ **Fallback seguro**: Si no hay key configurada, la app sigue funcionando  
✅ **Scope correcto**: Solo las páginas públicas tienen ReCaptcha (no el dashboard)  
✅ **Performance**: Script cargado de forma asíncrona y diferida  

---

## Variables de Entorno Requeridas

Asegúrate de tener configurada la variable de entorno:

```env
# .env.local
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=tu_site_key_aqui
```

**Obtener Site Key**:
1. Ir a [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Crear un nuevo sitio (reCAPTCHA v3)
3. Copiar el Site Key
4. Agregar a `.env.local`

---

## Testing Manual

### ✅ Escenario 1: Acceder a Mis Reparaciones
1. Ir a `/mis-reparaciones`
2. Verificar que la página carga sin errores
3. Abrir consola del navegador
4. **Resultado**: ✅ No hay errores de ReCaptcha

### ✅ Escenario 2: Enviar Formulario
1. Ingresar número de ticket: `R-2026-00042`
2. Ingresar email o teléfono
3. Click en "Ver mi reparación"
4. **Resultado**: ✅ ReCaptcha se ejecuta correctamente

### ✅ Escenario 3: Sin Site Key Configurada
1. Eliminar `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` de `.env.local`
2. Reiniciar servidor
3. Ir a `/mis-reparaciones`
4. **Resultado**: ✅ Página funciona sin ReCaptcha (fallback)

### ✅ Escenario 4: Verificar Badge de ReCaptcha
1. Ir a `/mis-reparaciones`
2. Scroll hasta el final de la página
3. **Resultado**: ✅ Se ve el badge de reCAPTCHA en la esquina inferior derecha

---

## Archivos Modificados

### 1. `src/app/(public)/layout.tsx`
- Importado `RecaptchaProvider`
- Envuelto el contenido en `<RecaptchaProvider>`

**Cambios**:
```diff
+ import { RecaptchaProvider } from '@/components/public/RecaptchaProvider'

  export default function PublicLayout({ children }) {
    return (
+     <RecaptchaProvider>
        <div className="flex min-h-screen flex-col">
          <PublicHeader />
          <main className="flex-1">{children}</main>
          <PublicFooter />
        </div>
+     </RecaptchaProvider>
    )
  }
```

---

## Componentes Relacionados

### RecaptchaProvider
**Ubicación**: `src/components/public/RecaptchaProvider.tsx`  
**Propósito**: Envolver páginas públicas con el contexto de ReCaptcha  
**Características**:
- Client component (`'use client'`)
- Lee `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` de env
- Fallback si no hay key configurada
- Script cargado de forma asíncrona

### MisReparacionesPage
**Ubicación**: `src/app/(public)/mis-reparaciones/page.tsx`  
**Propósito**: Página de autenticación para rastrear reparaciones  
**Características**:
- Usa `useGoogleReCaptcha()` hook
- Valida formulario con ReCaptcha
- Envía token al servidor para verificación
- Redirige a página de detalles si es válido

---

## API de Verificación

### Endpoint: `/api/public/repairs/auth`

```tsx
// Ejemplo de verificación en el servidor
export async function POST(request: Request) {
  const { contact, ticketNumber, recaptchaToken } = await request.json()
  
  // 1. Verificar token de ReCaptcha con Google
  const recaptchaResponse = await fetch(
    'https://www.google.com/recaptcha/api/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
    }
  )
  
  const recaptchaData = await recaptchaResponse.json()
  
  if (!recaptchaData.success || recaptchaData.score < 0.5) {
    return Response.json({ success: false, error: 'Verificación fallida' })
  }
  
  // 2. Verificar credenciales del cliente
  // ...
  
  return Response.json({ success: true })
}
```

---

## Conceptos Técnicos

### React Context Pattern

```tsx
// Provider (envuelve la app)
<GoogleReCaptchaProvider reCaptchaKey="...">
  {children}
</GoogleReCaptchaProvider>

// Consumer (usa el hook)
const { executeRecaptcha } = useGoogleReCaptcha()
```

### ReCaptcha v3 Score

ReCaptcha v3 retorna un score de 0.0 a 1.0:
- **1.0**: Muy probablemente humano
- **0.5**: Umbral recomendado
- **0.0**: Muy probablemente bot

### Client vs Server Components

```tsx
// ❌ No funciona - Server Component
export default function Page() {
  const { executeRecaptcha } = useGoogleReCaptcha() // Error: hooks solo en client
}

// ✅ Funciona - Client Component
'use client'
export default function Page() {
  const { executeRecaptcha } = useGoogleReCaptcha() // OK
}
```

---

## Seguridad

### Variables de Entorno

```env
# Pública (frontend)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Lc...

# Privada (backend)
RECAPTCHA_SECRET_KEY=6Lc...
```

**Importante**:
- `NEXT_PUBLIC_*` se expone al cliente (OK para site key)
- Secret key NUNCA debe exponerse al cliente
- Secret key solo se usa en el servidor para verificar

### Verificación en Dos Pasos

1. **Cliente**: Ejecuta ReCaptcha, obtiene token
2. **Servidor**: Verifica token con Google, valida score

```
Cliente                    Servidor                    Google
   |                          |                           |
   |-- executeRecaptcha() --->|                           |
   |<------ token ------------|                           |
   |                          |                           |
   |-- POST /api/auth ------->|                           |
   |   (con token)            |                           |
   |                          |-- verify token ---------->|
   |                          |<----- score + success ----|
   |                          |                           |
   |<----- success/error -----|                           |
```

---

## Notas Técnicas

- ReCaptcha v3 es invisible (no requiere interacción del usuario)
- El badge de ReCaptcha aparece automáticamente en la esquina inferior derecha
- El script se carga de forma asíncrona para no bloquear el render
- El provider verifica si hay site key antes de cargar el script
- Si no hay site key, la app funciona sin ReCaptcha (útil para desarrollo)

---

## Problemas Relacionados Resueltos

1. ✅ **Error de contexto**: Resuelto agregando provider al layout
2. ✅ **Scope incorrecto**: Solo páginas públicas tienen ReCaptcha
3. ✅ **Fallback**: App funciona sin site key configurada
4. ✅ **Performance**: Script cargado de forma óptima

---

## Conclusión

✅ Error de ReCaptcha resuelto completamente. La página `/mis-reparaciones` ahora puede usar el hook `useGoogleReCaptcha()` correctamente, protegiendo el formulario contra bots y accesos automatizados.

---

**Próximos Pasos Recomendados**:

1. Configurar `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` en producción
2. Configurar `RECAPTCHA_SECRET_KEY` en el servidor
3. Ajustar umbral de score según necesidades (actualmente 0.5)
4. Monitorear intentos de acceso en Google ReCaptcha Admin
5. Considerar agregar ReCaptcha a otros formularios públicos
