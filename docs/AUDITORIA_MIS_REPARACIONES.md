# Auditoría de Seguridad y Funcionalidad: /mis-reparaciones

**Fecha:** 15 de febrero de 2026  
**Sección:** Portal Público - Rastreo de Reparaciones  
**Alcance:** Autenticación, visualización de estado, seguridad y experiencia de usuario

---

## 1. RESUMEN EJECUTIVO

La sección `/mis-reparaciones` permite a los clientes rastrear el estado de sus reparaciones sin necesidad de crear una cuenta. El sistema utiliza autenticación temporal basada en JWT con validación de ticket y contacto.

### Hallazgos Principales

✅ **Fortalezas:**
- Autenticación sin fricción (no requiere registro)
- Rate limiting implementado correctamente
- Tokens JWT con expiración de 30 minutos
- Filtrado de datos sensibles en respuestas públicas
- Validación robusta de entrada con Zod

⚠️ **Áreas de Mejora:**
- Falta de logging de intentos fallidos
- No hay sistema de bloqueo temporal por intentos excesivos
- Tokens almacenados en sessionStorage (vulnerable a XSS)
- Falta de HTTPS enforcement explícito
- No hay notificación al cliente sobre accesos a su reparación

---

## 2. ARQUITECTURA DEL SISTEMA

### 2.1 Flujo de Autenticación

```
Cliente → Formulario (/mis-reparaciones)
   ↓
   POST /api/public/repairs/auth
   ↓
   Validación (ticket + email/teléfono)
   ↓
   Rate Limiting (10 intentos/15 min)
   ↓
   Generación de JWT (30 min)
   ↓
   Almacenamiento en sessionStorage
   ↓
   Redirección a /mis-reparaciones/[ticketId]
```

### 2.2 Archivos Principales

**Páginas:**
- `src/app/(public)/mis-reparaciones/page.tsx` - Formulario de autenticación
- `src/app/(public)/mis-reparaciones/[ticketId]/page.tsx` - Vista de detalles
- `src/app/(public)/mis-reparaciones/layout.tsx` - Metadatos SEO

**APIs:**
- `src/app/api/public/repairs/auth/route.ts` - Autenticación
- `src/app/api/public/repairs/[ticketId]/route.ts` - Obtención de datos

**Seguridad:**
- `src/lib/public-session.ts` - Gestión de JWT
- `src/lib/rate-limiter.ts` - Protección contra abuso
- `src/schemas/public-auth.schema.ts` - Validación de entrada

---

## 3. ANÁLISIS DE SEGURIDAD

### 3.1 Autenticación y Autorización

#### ✅ Implementado Correctamente

1. **Validación de Entrada**
   ```typescript
   // src/schemas/public-auth.schema.ts
   export const repairAuthSchema = z.object({
     contact: z.string()
       .min(5, 'Ingresa un email o teléfono válido')
       .refine((val) => {
         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
         const phoneRegex = /^\+?[\d\s-]{8,}$/
         return emailRegex.test(val) || phoneRegex.test(val.replace(/\s|-/g, ''))
       }),
     ticketNumber: z.string()
       .regex(/^R-\d{4}-\d+$/, 'Formato de ticket inválido')
   })
   ```

2. **Verificación de Contacto**
   ```typescript
   // Verifica que el contacto coincida con el cliente
   const contactMatch = 
     customer.email?.toLowerCase() === contact.toLowerCase() ||
     customer.phone?.replace(/\s|-/g, '') === contact.replace(/\s|-/g, '')
   ```

3. **Tokens JWT con Expiración**
   ```typescript
   const tokenExpiresIn = 30 * 60 // 30 minutos
   const token = await generatePublicToken({
     repairId: repair.id,
     ticketNumber: repair.ticket_number,
     contact
   }, tokenExpiresIn)
   ```

#### ⚠️ Vulnerabilidades Identificadas

**CRÍTICO - Almacenamiento de Token en sessionStorage**
```typescript
// src/app/(public)/mis-reparaciones/page.tsx
sessionStorage.setItem('repair_token', data.data.token)
```

**Riesgo:** Vulnerable a ataques XSS. Si un atacante inyecta JavaScript malicioso, puede robar el token.

**Recomendación:**
```typescript
// Opción 1: Usar httpOnly cookies (más seguro)
// En el API route:
response.cookies.set('repair_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: tokenExpiresIn
})

// Opción 2: Implementar Content Security Policy
// En next.config.js:
headers: [
  {
    source: '/(.*)',
    headers: [
      {
        key: 'Content-Security-Policy',
        value: "script-src 'self' 'unsafe-inline' 'unsafe-eval';"
      }
    ]
  }
]
```

**MEDIO - Falta de Logging de Seguridad**
```typescript
// Actualmente solo hay logging básico
logger.warn('Public repair auth failed - ticket not found', { ticketNumber, clientIp })
```

**Recomendación:**
```typescript
// Implementar logging detallado de eventos de seguridad
interface SecurityEvent {
  type: 'auth_attempt' | 'auth_success' | 'auth_failure' | 'token_expired' | 'unauthorized_access'
  ticketNumber: string
  contact: string
  clientIp: string
  userAgent: string
  timestamp: string
  reason?: string
}

// Almacenar en tabla de auditoría
await supabase.from('security_audit_log').insert({
  event_type: 'auth_failure',
  ticket_number: ticketNumber,
  contact_hash: hashContact(contact), // No almacenar contacto en texto plano
  client_ip: clientIp,
  user_agent: request.headers.get('user-agent'),
  reason: 'contact_mismatch'
})
```

### 3.2 Rate Limiting

#### ✅ Implementación Actual

```typescript
// src/lib/rate-limiter.ts
const isAllowed = rateLimiter.check(clientIp, 10, 15 * 60 * 1000)
// 10 intentos por 15 minutos por IP
```

#### ⚠️ Limitaciones

1. **Solo basado en IP:** Fácil de evadir con VPN/proxy
2. **Sin bloqueo progresivo:** No aumenta el tiempo de bloqueo por intentos repetidos
3. **En memoria:** Se pierde al reiniciar el servidor

**Recomendación:**
```typescript
// Implementar rate limiting multi-capa
interface RateLimitConfig {
  byIp: { max: 10, window: 15 * 60 * 1000 }
  byTicket: { max: 5, window: 15 * 60 * 1000 }
  byContact: { max: 3, window: 15 * 60 * 1000 }
}

// Usar Redis para persistencia
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function checkRateLimit(key: string, max: number, window: number) {
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, window)
  }
  return count <= max
}

// Implementar bloqueo progresivo
const attempts = await redis.get(`failed_attempts:${clientIp}`)
if (attempts > 5) {
  const blockTime = Math.min(Math.pow(2, attempts - 5) * 60, 3600) // Max 1 hora
  return { blocked: true, retryAfter: blockTime }
}
```

### 3.3 Filtrado de Datos Sensibles

#### ✅ Implementación Correcta

```typescript
// src/app/api/public/repairs/[ticketId]/route.ts
const publicRepair: PublicRepair = {
  ticketNumber: repair.ticket_number,
  device: repair.device,
  brand: repair.brand,
  model: repair.model,
  issue: repair.issue,
  status: repair.status,
  priority: repair.priority,
  createdAt: repair.created_at,
  estimatedCost: repair.estimatedCost || 0,
  finalCost: repair.finalCost,
  warrantyMonths: repair.warrantyMonths,
  warrantyType: repair.warrantyType,
  technician: repair.technician ? {
    name: (repair.technician as any).name // Solo nombre, no ID ni email
  } : null,
  customer: {
    name: (repair.customer as any).name,
    phone: (repair.customer as any).phone // Solo teléfono, no email completo
  }
}
```

**Datos Excluidos (Correcto):**
- ❌ Notas internas del técnico
- ❌ Costos de compra de piezas
- ❌ Información de proveedores
- ❌ IDs internos de base de datos
- ❌ Email completo del cliente
- ❌ Contraseñas de acceso al dispositivo

#### ⚠️ Posible Mejora

**Ofuscar teléfono parcialmente:**
```typescript
function maskPhone(phone: string): string {
  // Mostrar solo últimos 4 dígitos
  return phone.replace(/(\d{4})$/, '****$1')
}

customer: {
  name: customer.name,
  phone: maskPhone(customer.phone) // 0981****5678
}
```

---

## 4. ANÁLISIS FUNCIONAL

### 4.1 Flujo de Usuario

#### Paso 1: Formulario de Autenticación

**Archivo:** `src/app/(public)/mis-reparaciones/page.tsx`

```typescript
const [formData, setFormData] = useState({
  contact: '',
  ticketNumber: ''
})

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)

  const response = await fetch('/api/public/repairs/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  })

  const data = await response.json()

  if (data.success) {
    sessionStorage.setItem('repair_token', data.data.token)
    router.push(`/mis-reparaciones/${formData.ticketNumber}`)
  }
}
```

**✅ Aspectos Positivos:**
- Validación en tiempo real
- Mensajes de error claros
- Loading state durante autenticación
- Placeholder con ejemplos

**⚠️ Mejoras Sugeridas:**

1. **Agregar CAPTCHA para prevenir bots:**
```typescript
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3'

const { executeRecaptcha } = useGoogleReCaptcha()

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  
  if (!executeRecaptcha) {
    toast.error('Error de verificación')
    return
  }
  
  const token = await executeRecaptcha('repair_auth')
  
  const response = await fetch('/api/public/repairs/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...formData, recaptchaToken: token })
  })
}
```

2. **Agregar recordatorio de ticket:**
```typescript
<div className="mt-4 text-center">
  <Button variant="link" onClick={() => setShowTicketHelp(true)}>
    ¿No encuentras tu número de ticket?
  </Button>
</div>

{showTicketHelp && (
  <Alert>
    <AlertDescription>
      Tu número de ticket está en el comprobante que recibiste al dejar tu dispositivo.
      También puedes solicitarlo por WhatsApp al {settings.companyPhone}.
    </AlertDescription>
  </Alert>
)}
```

#### Paso 2: Vista de Detalles

**Archivo:** `src/app/(public)/mis-reparaciones/[ticketId]/page.tsx`

**✅ Información Mostrada:**
- Estado actual con badge visual
- Prioridad de la reparación
- Información del dispositivo
- Problema reportado
- Costos (estimado y final)
- Fechas (ingreso, estimación)
- Garantía (si aplica)
- Técnico asignado

**⚠️ Funcionalidades Faltantes:**

1. **Historial de Estados:**
```typescript
interface StatusHistory {
  status: RepairStatus
  changedAt: string
  note?: string
}

// Mostrar timeline de cambios
<div className="space-y-2">
  {statusHistory.map((entry, index) => (
    <div key={index} className="flex items-center gap-3">
      <div className="h-2 w-2 rounded-full bg-primary" />
      <div>
        <p className="font-medium">{STATUS_CONFIG[entry.status].label}</p>
        <p className="text-sm text-muted-foreground">
          {formatDate(entry.changedAt)}
        </p>
      </div>
    </div>
  ))}
</div>
```

2. **Notificaciones por Email/SMS:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Recibir Notificaciones</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <Label>
        <input type="checkbox" checked={notifications.email} />
        Notificarme por email
      </Label>
      <Label>
        <input type="checkbox" checked={notifications.sms} />
        Notificarme por SMS
      </Label>
    </div>
    <Button onClick={saveNotificationPreferences}>
      Guardar Preferencias
    </Button>
  </CardContent>
</Card>
```

3. **Chat o Mensajes con el Técnico:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Mensajes</CardTitle>
  </CardHeader>
  <CardContent>
    <ScrollArea className="h-64">
      {messages.map(msg => (
        <div key={msg.id} className={msg.from === 'customer' ? 'text-right' : 'text-left'}>
          <p className="text-sm">{msg.content}</p>
          <span className="text-xs text-muted-foreground">
            {formatDate(msg.sentAt)}
          </span>
        </div>
      ))}
    </ScrollArea>
    <Textarea placeholder="Escribe un mensaje..." />
    <Button>Enviar</Button>
  </CardContent>
</Card>
```

### 4.2 Manejo de Errores

#### ✅ Errores Manejados

```typescript
// Token expirado
if (!token) {
  toast.error('Sesión expirada')
  router.push('/mis-reparaciones')
  return
}

// Ticket no encontrado
if (!data.success) {
  toast.error(data.error || 'Error al cargar reparación')
  router.push('/mis-reparaciones')
  return
}

// Rate limit excedido
if (response.status === 429) {
  toast.error(`Demasiados intentos. Intenta de nuevo en ${resetTime} segundos.`)
}
```

#### ⚠️ Mejoras Sugeridas

1. **Página de Error Personalizada:**
```typescript
// src/app/(public)/mis-reparaciones/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="container py-12 text-center">
      <h2 className="text-2xl font-bold">Algo salió mal</h2>
      <p className="mt-2 text-muted-foreground">
        No pudimos cargar la información de tu reparación.
      </p>
      <Button onClick={reset} className="mt-4">
        Intentar de nuevo
      </Button>
    </div>
  )
}
```

2. **Retry Automático con Exponential Backoff:**
```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) return response
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter || '5') * 1000))
        continue
      }
      
      throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
    }
  }
}
```

---

## 5. EXPERIENCIA DE USUARIO (UX)

### 5.1 Accesibilidad

#### ✅ Implementado

- Etiquetas semánticas (`<Label>`, `<CardTitle>`)
- Contraste de colores adecuado
- Mensajes de error descriptivos

#### ⚠️ Faltante

1. **ARIA Labels:**
```typescript
<Input
  id="ticketNumber"
  aria-label="Número de ticket de reparación"
  aria-describedby="ticket-help"
  aria-required="true"
/>
<p id="ticket-help" className="text-xs text-muted-foreground">
  Ejemplo: R-2026-00042
</p>
```

2. **Navegación por Teclado:**
```typescript
// Agregar shortcuts
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      router.push('/mis-reparaciones')
    }
  }
  window.addEventListener('keydown', handleKeyPress)
  return () => window.removeEventListener('keydown', handleKeyPress)
}, [])
```

3. **Screen Reader Support:**
```typescript
<div role="status" aria-live="polite">
  {loading && <span className="sr-only">Cargando información de reparación...</span>}
</div>
```

### 5.2 Responsive Design

#### ✅ Implementado

```typescript
<div className="grid gap-6 lg:grid-cols-3">
  <div className="lg:col-span-2 space-y-6">
    {/* Contenido principal */}
  </div>
  <div className="space-y-6">
    {/* Sidebar */}
  </div>
</div>
```

#### ⚠️ Mejoras Sugeridas

1. **Optimización Móvil:**
```typescript
// Usar tabs en móvil para ahorrar espacio
<Tabs defaultValue="info" className="md:hidden">
  <TabsList>
    <TabsTrigger value="info">Info</TabsTrigger>
    <TabsTrigger value="dates">Fechas</TabsTrigger>
    <TabsTrigger value="costs">Costos</TabsTrigger>
  </TabsList>
</Tabs>

// Desktop: mostrar todo en grid
<div className="hidden md:grid md:grid-cols-3 gap-6">
  {/* Contenido completo */}
</div>
```

2. **PWA Support:**
```typescript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
})

module.exports = withPWA({
  // ... config
})

// manifest.json
{
  "name": "Rastreo de Reparaciones",
  "short_name": "Mis Reparaciones",
  "start_url": "/mis-reparaciones",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [...]
}
```

### 5.3 Performance

#### ⚠️ Optimizaciones Recomendadas

1. **Lazy Loading de Imágenes:**
```typescript
import Image from 'next/image'

<Image
  src={repair.images[0]?.url}
  alt="Imagen del dispositivo"
  width={400}
  height={300}
  loading="lazy"
  placeholder="blur"
/>
```

2. **Prefetching:**
```typescript
// Prefetch la página de detalles al hacer hover
<Link
  href={`/mis-reparaciones/${ticketNumber}`}
  prefetch={true}
>
  Ver mi reparación
</Link>
```

3. **Caching de Respuestas:**
```typescript
// En el API route
export const revalidate = 60 // Revalidar cada 60 segundos

// O usar SWR en el cliente
import useSWR from 'swr'

const { data, error } = useSWR(
  `/api/public/repairs/${ticketId}`,
  fetcher,
  { refreshInterval: 30000 } // Actualizar cada 30 segundos
)
```

---

## 6. CUMPLIMIENTO Y PRIVACIDAD

### 6.1 GDPR / Protección de Datos

#### ⚠️ Consideraciones Legales

1. **Aviso de Privacidad:**
```typescript
// Agregar en el formulario
<div className="mt-4 text-xs text-muted-foreground">
  Al acceder a tu reparación, aceptas nuestra{' '}
  <Link href="/privacidad" className="underline">
    Política de Privacidad
  </Link>
  . Tus datos son utilizados únicamente para gestionar tu reparación.
</div>
```

2. **Derecho al Olvido:**
```typescript
// Agregar opción para eliminar datos
<Button variant="destructive" onClick={requestDataDeletion}>
  Solicitar Eliminación de Datos
</Button>

// API endpoint
POST /api/public/repairs/delete-request
{
  ticketNumber: string
  contact: string
  reason: string
}
```

3. **Exportación de Datos:**
```typescript
// Permitir descargar información
<Button onClick={exportRepairData}>
  Descargar Mis Datos (PDF)
</Button>

async function exportRepairData() {
  const response = await fetch(`/api/public/repairs/${ticketId}/export`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  const blob = await response.blob()
  downloadFile(blob, `reparacion-${ticketNumber}.pdf`)
}
```

### 6.2 Auditoría y Compliance

#### ⚠️ Implementar Sistema de Auditoría

```typescript
// Tabla de auditoría en Supabase
create table public_access_audit (
  id uuid primary key default uuid_generate_v4(),
  ticket_number text not null,
  contact_hash text not null, -- Hash del contacto, no texto plano
  client_ip inet,
  user_agent text,
  action text not null, -- 'auth', 'view', 'export'
  success boolean not null,
  failure_reason text,
  created_at timestamp with time zone default now()
);

// Registrar cada acceso
await supabase.from('public_access_audit').insert({
  ticket_number: ticketNumber,
  contact_hash: await hashContact(contact),
  client_ip: clientIp,
  user_agent: request.headers.get('user-agent'),
  action: 'view',
  success: true
})
```

---

## 7. RECOMENDACIONES PRIORITARIAS

### 🔴 CRÍTICAS (Implementar Inmediatamente)

1. **Migrar tokens de sessionStorage a httpOnly cookies**
   - Previene robo de tokens por XSS
   - Implementación: 2-4 horas

2. **Agregar logging de seguridad completo**
   - Detectar patrones de ataque
   - Implementación: 4-6 horas

3. **Implementar CAPTCHA en formulario de autenticación**
   - Previene ataques automatizados
   - Implementación: 2-3 horas

### 🟡 IMPORTANTES (Implementar en 1-2 semanas)

4. **Rate limiting multi-capa con Redis**
   - Protección más robusta
   - Implementación: 6-8 horas

5. **Historial de estados de reparación**
   - Mejora transparencia para el cliente
   - Implementación: 4-6 horas

6. **Sistema de notificaciones (email/SMS)**
   - Mantiene al cliente informado
   - Implementación: 8-12 horas

### 🟢 DESEABLES (Implementar en 1 mes)

7. **Chat con técnico**
   - Mejora comunicación
   - Implementación: 12-16 horas

8. **PWA support**
   - Experiencia móvil mejorada
   - Implementación: 4-6 horas

9. **Exportación de datos (GDPR)**
   - Cumplimiento legal
   - Implementación: 6-8 horas

---

## 8. CHECKLIST DE SEGURIDAD

### Autenticación
- [x] Validación de entrada con Zod
- [x] Verificación de contacto
- [x] Tokens JWT con expiración
- [ ] Tokens en httpOnly cookies
- [ ] CAPTCHA implementado
- [ ] Bloqueo progresivo por intentos fallidos

### Autorización
- [x] Verificación de ticket en cada request
- [x] Filtrado de datos sensibles
- [ ] Logging de accesos
- [ ] Notificación al cliente sobre accesos

### Rate Limiting
- [x] Límite por IP (10/15min)
- [ ] Límite por ticket
- [ ] Límite por contacto
- [ ] Persistencia en Redis
- [ ] Bloqueo progresivo

### Privacidad
- [x] Datos mínimos expuestos
- [ ] Aviso de privacidad
- [ ] Derecho al olvido
- [ ] Exportación de datos
- [ ] Auditoría de accesos

### Performance
- [ ] Lazy loading de imágenes
- [ ] Caching de respuestas
- [ ] Prefetching
- [ ] PWA support

### Accesibilidad
- [x] Etiquetas semánticas
- [ ] ARIA labels
- [ ] Navegación por teclado
- [ ] Screen reader support

---

## 9. CONCLUSIÓN

La sección `/mis-reparaciones` tiene una base sólida con autenticación funcional y filtrado de datos sensibles. Sin embargo, requiere mejoras críticas en seguridad (migración a httpOnly cookies, logging) y funcionalidad (historial de estados, notificaciones).

**Prioridad de Implementación:**
1. Seguridad (Semana 1)
2. Funcionalidad básica (Semana 2-3)
3. Mejoras UX (Semana 4)

**Estimación Total:** 60-80 horas de desarrollo

---

**Auditor:** Kiro AI  
**Revisión:** Pendiente  
**Próxima Auditoría:** Después de implementar recomendaciones críticas
