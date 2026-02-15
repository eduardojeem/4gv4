# Auditoría de /admin/website

**Fecha:** 15 de febrero de 2026  
**Sección:** Configuración del Sitio Web  
**Alcance:** Frontend, Backend, Seguridad y UX

---

## 1. Resumen Ejecutivo

### Estado General: ⚠️ BUENO - Requiere Mejoras Menores

La sección `/admin/website` es funcional y bien diseñada, pero presenta algunas áreas de mejora en validación, seguridad y manejo de errores.

### Hallazgos Principales
- ✅ **UI/UX excelente** - Diseño moderno con gradientes y animaciones
- ✅ **Componentes bien organizados** - Separación clara de responsabilidades
- ✅ **APIs protegidas** - Uso de withAdminAuth
- ⚠️ **Falta validación de entrada** - No hay sanitización de datos
- ⚠️ **Sin límites de longitud** - Campos sin restricciones
- ⚠️ **Manejo de errores básico** - Falta feedback detallado

---

## 2. Arquitectura

### 2.1 Estructura de Archivos

```
src/app/admin/website/
├── layout.tsx                    # Layout simple (pass-through)
└── page.tsx                      # Página principal con tabs

src/components/admin/website/
├── CompanyInfoForm.tsx           # Información de la empresa
├── HeroEditor.tsx                # Editor de hero y stats
├── ServicesManager.tsx           # Gestor de servicios (3 servicios)
└── TestimonialsManager.tsx       # Gestor de testimonios

src/hooks/
└── useWebsiteSettings.ts         # Hook para gestión de settings

src/types/
└── website-settings.ts           # Definiciones de tipos

src/app/api/admin/website/settings/
├── route.ts                      # GET all settings
└── [key]/route.ts                # PUT specific setting
```

### 2.2 Flujo de Datos

```
Usuario → Componente → useAdminWebsiteSettings → API → Supabase
                ↓                                    ↓
            Estado Local                      website_settings
```

---

## 3. Análisis de Componentes

### 3.1 Página Principal (page.tsx)

**Funcionalidad:**
- ✅ Tabs para 4 secciones (Empresa, Hero, Servicios, Testimonios)
- ✅ Header premium con gradientes
- ✅ Botón de vista previa al sitio público
- ✅ Diseño responsive

**Fortalezas:**
- UI moderna y atractiva
- Navegación clara con tabs
- Iconos descriptivos

**Áreas de Mejora:**
- No hay breadcrumbs
- Falta indicador de cambios sin guardar

**Código:**
```typescript
// ✅ Buena organización
<Tabs defaultValue="company">
  <TabsContent value="company">
    <CompanyInfoForm />
  </TabsContent>
  // ...
</Tabs>
```

---

### 3.2 CompanyInfoForm

**Funcionalidad:**
- Edición de teléfono, email, dirección
- Horarios de atención (lunes-viernes, sábado, domingo)
- Guardado individual

**Fortalezas:**
- ✅ Diseño con gradientes por sección
- ✅ Iconos contextuales
- ✅ Feedback visual de cambios
- ✅ Loading states

**Vulnerabilidades:**

#### ⚠️ MEDIA #1: Sin Validación de Email
```typescript
// ACTUAL
<Input
  type="email"
  value={formData.email}
  onChange={(e) => handleChange('email', e.target.value)}
/>

// RECOMENDADO
const validateEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

// En handleSubmit
if (!validateEmail(formData.email)) {
  toast.error('Email inválido')
  return
}
```

#### ⚠️ MEDIA #2: Sin Validación de Teléfono
```typescript
// RECOMENDADO
const validatePhone = (phone: string) => {
  // Permitir formatos: +595 123 456 789, 0981234567, etc.
  const regex = /^[\d\s\+\-\(\)]+$/
  return regex.test(phone) && phone.replace(/\D/g, '').length >= 9
}
```

#### ⚠️ MEDIA #3: Sin Límites de Longitud
```typescript
// RECOMENDADO
<Input
  maxLength={100}
  value={formData.phone}
  // ...
/>
```

---

### 3.3 HeroEditor

**Funcionalidad:**
- Edición de badge, título, subtítulo
- Edición de estadísticas (reparaciones, satisfacción, tiempo)
- Dos formularios independientes

**Fortalezas:**
- ✅ Separación lógica (contenido vs stats)
- ✅ UI atractiva con gradientes
- ✅ Guardado independiente

**Vulnerabilidades:**

#### ⚠️ MEDIA #4: Sin Validación de Formato de Stats
```typescript
// ACTUAL
<Input
  value={heroStats.repairs}
  onChange={(e) => setHeroStats({ ...heroStats, repairs: e.target.value })}
/>

// RECOMENDADO
const validateStat = (value: string) => {
  // Permitir: 10K+, 98%, 24-48h, etc.
  return value.length <= 20 && /^[\d\w\+\-\%\s]+$/.test(value)
}
```

#### ⚠️ BAJA #5: Sin Límite de Caracteres en Textos
```typescript
// RECOMENDADO
<Input
  maxLength={100}
  value={heroContent.title}
/>

<Textarea
  maxLength={200}
  value={heroContent.subtitle}
/>
```

---

### 3.4 ServicesManager

**Funcionalidad:**
- Gestión de 3 servicios fijos
- Edición de título, descripción, icono, color
- Gestión de beneficios (agregar/eliminar)
- Guardado masivo

**Fortalezas:**
- ✅ UI excelente con preview de iconos y colores
- ✅ Gestión dinámica de beneficios
- ✅ Validación visual de selección

**Vulnerabilidades:**

#### ⚠️ MEDIA #6: Sin Validación de Beneficios Vacíos
```typescript
// ACTUAL
const handleAddBenefit = (serviceIndex: number) => {
  updated[serviceIndex].benefits = [...updated[serviceIndex].benefits, '']
}

// RECOMENDADO
const handleSave = async () => {
  // Filtrar beneficios vacíos antes de guardar
  const cleanedServices = services.map(service => ({
    ...service,
    benefits: service.benefits.filter(b => b.trim().length > 0)
  }))
  
  await updateSetting('services', cleanedServices)
}
```

#### ⚠️ MEDIA #7: Sin Límite de Beneficios
```typescript
// RECOMENDADO
const MAX_BENEFITS = 10

const handleAddBenefit = (serviceIndex: number) => {
  if (services[serviceIndex].benefits.length >= MAX_BENEFITS) {
    toast.error(`Máximo ${MAX_BENEFITS} beneficios por servicio`)
    return
  }
  // ...
}
```

#### ⚠️ BAJA #8: Iconos Hardcodeados
```typescript
// ACTUAL
const ICON_OPTIONS = [
  { value: 'Wrench', label: 'Herramienta', icon: Wrench },
  { value: 'Shield', label: 'Escudo', icon: Shield },
  { value: 'Package', label: 'Paquete', icon: Package },
]

// RECOMENDADO: Mover a configuración o base de datos
// Permitir agregar más iconos sin cambiar código
```

---

### 3.5 TestimonialsManager

**Funcionalidad:**
- Agregar/eliminar testimonios
- Edición de nombre, rating, comentario
- Guardado masivo
- Drag & drop visual (UI preparada)

**Fortalezas:**
- ✅ CRUD completo
- ✅ Preview de estrellas
- ✅ UI con gradientes
- ✅ Estado vacío bien diseñado

**Vulnerabilidades:**

#### ⚠️ MEDIA #9: Sin Límite de Testimonios
```typescript
// RECOMENDADO
const MAX_TESTIMONIALS = 20

const handleAdd = () => {
  if (testimonials.length >= MAX_TESTIMONIALS) {
    toast.error(`Máximo ${MAX_TESTIMONIALS} testimonios`)
    return
  }
  // ...
}
```

#### ⚠️ MEDIA #10: Sin Validación de Rating
```typescript
// ACTUAL
<Input
  type="number"
  min="1"
  max="5"
  value={testimonial.rating}
/>

// RECOMENDADO: Validar en onChange
onChange={(e) => {
  const value = parseInt(e.target.value)
  if (value >= 1 && value <= 5) {
    handleUpdate(testimonial.id, 'rating', value)
  }
}}
```

#### ⚠️ MEDIA #11: Sin Sanitización de Comentarios
```typescript
// RECOMENDADO
const sanitizeComment = (comment: string) => {
  return comment
    .trim()
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remover scripts
    .replace(/<[^>]+>/g, '') // Remover HTML tags
    .substring(0, 500) // Límite de caracteres
}
```

#### ⚠️ BAJA #12: Drag & Drop No Implementado
```typescript
// UI muestra GripVertical pero no hay funcionalidad
// RECOMENDADO: Implementar reordenamiento con react-beautiful-dnd
```

---

## 4. Hook useAdminWebsiteSettings

**Funcionalidad:**
- Fetch de settings desde API
- Update de settings individuales
- Estado de loading y saving
- Manejo de errores

**Fortalezas:**
- ✅ Separación de lógica
- ✅ Estados de carga
- ✅ Actualización optimista del estado local

**Vulnerabilidades:**

#### ⚠️ MEDIA #13: Sin Retry en Errores
```typescript
// ACTUAL
catch (err) {
  setError(err instanceof Error ? err.message : 'Failed to load settings')
}

// RECOMENDADO
const fetchSettings = async (retries = 3) => {
  try {
    // ...
  } catch (err) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      return fetchSettings(retries - 1)
    }
    setError(err instanceof Error ? err.message : 'Failed to load settings')
  }
}
```

#### ⚠️ MEDIA #14: Sin Validación de Response
```typescript
// ACTUAL
setSettings(data.data as WebsiteSettings)

// RECOMENDADO
const validateSettings = (data: any): data is WebsiteSettings => {
  return (
    data &&
    typeof data.company_info === 'object' &&
    typeof data.hero_content === 'object' &&
    Array.isArray(data.services) &&
    Array.isArray(data.testimonials)
  )
}

if (!validateSettings(data.data)) {
  throw new Error('Invalid settings format')
}
```

---

## 5. APIs Backend

### 5.1 GET /api/admin/website/settings

**Seguridad:**
- ✅ Protegido con withAdminAuth
- ✅ Verifica rol de admin
- ✅ Logging de acceso

**Código:**
```typescript
export const GET = withAdminAuth(handler)
```

**Fortalezas:**
- Implementación correcta
- Auditoría automática

**Sin problemas detectados** ✅

---

### 5.2 PUT /api/admin/website/settings/[key]

**Seguridad:**
- ✅ Protegido con withAdminAuth
- ✅ Validación de keys permitidas
- ✅ Auditoría con old_values y new_values

**Vulnerabilidades:**

#### ⚠️ ALTA #15: Sin Validación de Estructura de Datos
```typescript
// ACTUAL
const { value } = body

if (!value) {
  return NextResponse.json({ error: 'Value is required' }, { status: 400 })
}

// RECOMENDADO
const validateValue = (key: string, value: any) => {
  switch (key) {
    case 'company_info':
      return (
        value.phone && typeof value.phone === 'string' &&
        value.email && typeof value.email === 'string' &&
        value.address && typeof value.address === 'string' &&
        value.hours && typeof value.hours === 'object'
      )
    case 'services':
      return (
        Array.isArray(value) &&
        value.length === 3 &&
        value.every(s => s.title && s.description && s.benefits)
      )
    // ...
  }
}

if (!validateValue(key, value)) {
  return NextResponse.json({ error: 'Invalid value structure' }, { status: 400 })
}
```

#### ⚠️ ALTA #16: Sin Sanitización de Datos
```typescript
// RECOMENDADO
import DOMPurify from 'isomorphic-dompurify'

const sanitizeValue = (key: string, value: any) => {
  if (key === 'testimonials') {
    return value.map((t: Testimonial) => ({
      ...t,
      name: DOMPurify.sanitize(t.name),
      comment: DOMPurify.sanitize(t.comment)
    }))
  }
  // Sanitizar otros campos según tipo
  return value
}

const sanitizedValue = sanitizeValue(key, value)
```

#### ⚠️ MEDIA #17: Sin Rate Limiting
```typescript
// RECOMENDADO: Agregar rate limiting
// Máximo 10 actualizaciones por minuto por usuario

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
})

const { success } = await ratelimit.limit(context.user.id)
if (!success) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
}
```

---

## 6. Tipos y Validación

### 6.1 Definiciones de Tipos

**Archivo:** `src/types/website-settings.ts`

**Fortalezas:**
- ✅ Tipos bien definidos
- ✅ Interfaces claras
- ✅ Union types para opciones

**Áreas de Mejora:**

#### ⚠️ MEDIA #18: Falta Validación en Runtime
```typescript
// ACTUAL: Solo tipos de TypeScript (compile-time)

// RECOMENDADO: Agregar validación con Zod
import { z } from 'zod'

export const CompanyInfoSchema = z.object({
  phone: z.string().min(9).max(20),
  email: z.string().email(),
  address: z.string().min(10).max(200),
  hours: z.object({
    weekdays: z.string().max(50),
    saturday: z.string().max(50),
    sunday: z.string().max(50),
  })
})

export const ServiceSchema = z.object({
  id: z.string(),
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(500),
  icon: z.enum(['wrench', 'package', 'shield']),
  color: z.enum(['blue', 'green', 'purple']),
  benefits: z.array(z.string().max(200)).max(10)
})

export const TestimonialSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(100),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(500)
})
```

---

## 7. UX y Accesibilidad

### 7.1 Fortalezas

✅ **Diseño Visual:**
- Gradientes modernos y atractivos
- Iconos contextuales
- Animaciones suaves
- Responsive design

✅ **Feedback al Usuario:**
- Loading states
- Toast notifications
- Botones deshabilitados cuando corresponde
- Indicador de cambios sin guardar

✅ **Organización:**
- Tabs claros
- Secciones bien separadas
- Botones de acción visibles

### 7.2 Áreas de Mejora

#### ⚠️ BAJA #19: Falta Confirmación en Eliminaciones
```typescript
// ACTUAL
<Button onClick={() => handleDelete(testimonial.id)}>
  <Trash2 />
</Button>

// RECOMENDADO
const handleDelete = (id: string) => {
  if (confirm('¿Estás seguro de eliminar este testimonio?')) {
    // eliminar
  }
}

// O mejor: usar un Dialog de confirmación
```

#### ⚠️ BAJA #20: Sin Atajos de Teclado
```typescript
// RECOMENDADO
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

#### ⚠️ BAJA #21: Falta Indicador de Cambios Globales
```typescript
// RECOMENDADO: Mostrar banner si hay cambios sin guardar
{hasUnsavedChanges && (
  <div className="fixed top-0 left-0 right-0 bg-yellow-100 p-2 text-center">
    Tienes cambios sin guardar
  </div>
)}
```

---

## 8. Performance

### 8.1 Fortalezas

✅ **Optimizaciones:**
- Componentes client-side solo donde necesario
- Estado local para edición
- Guardado individual por sección

### 8.2 Áreas de Mejora

#### ⚠️ BAJA #22: Re-renders Innecesarios
```typescript
// ACTUAL: Cada cambio causa re-render
onChange={(e) => handleChange('phone', e.target.value)}

// RECOMENDADO: Debounce para inputs
import { useDebouncedCallback } from 'use-debounce'

const debouncedChange = useDebouncedCallback(
  (field, value) => handleChange(field, value),
  300
)
```

#### ⚠️ BAJA #23: Sin Caché de Settings
```typescript
// RECOMENDADO: Usar SWR o React Query
import useSWR from 'swr'

export function useAdminWebsiteSettings() {
  const { data, error, mutate } = useSWR(
    '/api/admin/website/settings',
    fetcher,
    { revalidateOnFocus: false }
  )
  // ...
}
```

---

## 9. Testing

### 9.1 Estado Actual

❌ **Sin Tests:**
- No hay tests unitarios
- No hay tests de integración
- No hay tests E2E

### 9.2 Tests Recomendados

```typescript
// CompanyInfoForm.test.tsx
describe('CompanyInfoForm', () => {
  it('validates email format', () => {
    // ...
  })
  
  it('validates phone format', () => {
    // ...
  })
  
  it('shows error for invalid data', () => {
    // ...
  })
  
  it('saves successfully with valid data', () => {
    // ...
  })
})

// ServicesManager.test.tsx
describe('ServicesManager', () => {
  it('limits benefits to 10 per service', () => {
    // ...
  })
  
  it('filters empty benefits before saving', () => {
    // ...
  })
})

// TestimonialsManager.test.tsx
describe('TestimonialsManager', () => {
  it('limits testimonials to 20', () => {
    // ...
  })
  
  it('validates rating between 1-5', () => {
    // ...
  })
  
  it('sanitizes comment content', () => {
    // ...
  })
})

// API tests
describe('PUT /api/admin/website/settings/[key]', () => {
  it('requires admin auth', () => {
    // ...
  })
  
  it('validates data structure', () => {
    // ...
  })
  
  it('sanitizes input', () => {
    // ...
  })
  
  it('logs changes in audit_log', () => {
    // ...
  })
})
```

---

## 10. Recomendaciones Prioritarias

### 10.1 Críticas (Implementar Esta Semana)

**No hay vulnerabilidades críticas** ✅

### 10.2 Altas (Implementar Este Mes)

1. **Validación de Estructura de Datos en API (#15)**
   - Validar formato de cada tipo de setting
   - Rechazar datos malformados
   - Prevenir corrupción de datos

2. **Sanitización de Datos (#16)**
   - Instalar DOMPurify
   - Sanitizar todos los inputs de usuario
   - Prevenir XSS

3. **Rate Limiting (#17)**
   - Limitar actualizaciones por usuario
   - Prevenir abuso de API
   - Proteger base de datos

### 10.3 Medias (Implementar en 2 Meses)

4. **Validación de Email y Teléfono (#1, #2)**
5. **Límites de Longitud en Todos los Campos (#3, #5)**
6. **Validación de Beneficios Vacíos (#6)**
7. **Límite de Beneficios por Servicio (#7)**
8. **Límite de Testimonios (#9)**
9. **Validación de Rating (#10)**
10. **Sanitización de Comentarios (#11)**
11. **Retry en Errores de Red (#13)**
12. **Validación de Response (#14)**
13. **Validación Runtime con Zod (#18)**

### 10.4 Bajas (Backlog)

14. **Iconos Configurables (#8)**
15. **Drag & Drop para Testimonios (#12)**
16. **Confirmación en Eliminaciones (#19)**
17. **Atajos de Teclado (#20)**
18. **Indicador de Cambios Globales (#21)**
19. **Debounce en Inputs (#22)**
20. **Caché con SWR (#23)**

---

## 11. Checklist de Implementación

### Validación y Seguridad
- [ ] Validar estructura de datos en API
- [ ] Sanitizar todos los inputs
- [ ] Implementar rate limiting
- [ ] Validar email y teléfono
- [ ] Agregar límites de longitud
- [ ] Validar ratings 1-5
- [ ] Filtrar beneficios vacíos
- [ ] Limitar cantidad de items

### UX y Accesibilidad
- [ ] Confirmación en eliminaciones
- [ ] Atajos de teclado (Ctrl+S)
- [ ] Indicador de cambios sin guardar
- [ ] Mensajes de error descriptivos
- [ ] Loading states consistentes

### Performance
- [ ] Debounce en inputs
- [ ] Caché con SWR/React Query
- [ ] Optimizar re-renders
- [ ] Lazy loading de componentes

### Testing
- [ ] Tests unitarios de componentes
- [ ] Tests de validación
- [ ] Tests de API
- [ ] Tests E2E del flujo completo

### Documentación
- [ ] Guía de uso para admins
- [ ] Documentación de tipos
- [ ] Ejemplos de valores válidos
- [ ] Troubleshooting común

---

## 12. Conclusiones

### Fortalezas
✅ UI/UX excelente y moderna  
✅ Componentes bien organizados  
✅ APIs protegidas con auth  
✅ Auditoría implementada  
✅ Código limpio y mantenible  

### Debilidades
⚠️ Falta validación de entrada  
⚠️ Sin sanitización de datos  
⚠️ Sin límites de longitud  
⚠️ Sin tests  
⚠️ Sin rate limiting  

### Riesgo General
**🟡 MEDIO** - Funcional y seguro a nivel de autenticación, pero vulnerable a datos malformados y XSS.

### Próximos Pasos
1. Implementar validación de estructura en API (esta semana)
2. Agregar sanitización con DOMPurify (esta semana)
3. Implementar rate limiting (este mes)
4. Agregar validaciones de frontend (este mes)
5. Escribir tests (próximo sprint)

---

**Auditor:** Kiro AI  
**Versión:** 1.0  
**Última Actualización:** 15 de febrero de 2026
