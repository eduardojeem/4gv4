# Auditoría de la Sección Admin

**Fecha:** 15 de febrero de 2026  
**Sistema:** Panel de Administración  
**Alcance:** Frontend, Backend, Seguridad y Permisos

---

## 1. Resumen Ejecutivo

### Estado General: ⚠️ CRÍTICO - Requiere Atención Inmediata

La sección admin presenta **vulnerabilidades de seguridad críticas** que permiten escalación de privilegios y acceso no autorizado. Se identificaron problemas en autenticación, autorización y políticas de seguridad.

### Hallazgos Críticos
- ❌ **Endpoint de auto-promoción sin validación** (`/api/admin/promote-self`)
- ❌ **Falta de middleware de autorización en rutas admin**
- ❌ **No existe componente AdminGuard implementado**
- ⚠️ **Validación de roles solo en frontend**
- ⚠️ **Importación masiva de usuarios sin restricciones**

---

## 2. Arquitectura del Sistema Admin

### 2.1 Estructura de Rutas

```
src/app/admin/
├── layout.tsx                    # Layout principal (sin protección)
├── page.tsx                      # Dashboard admin
├── analytics/                    # Análisis de datos
├── database-monitoring/          # Monitoreo de BD
├── inventory/                    # Gestión de inventario
├── notifications/                # Centro de notificaciones
├── prioritization/               # Sistema de priorización
├── reports/                      # Reportes del sistema
├── resources/                    # Recursos
├── security/                     # Panel de seguridad
├── settings/                     # Configuración
├── users/                        # Gestión de usuarios
├── verify/                       # Verificación
└── website/                      # Gestión del sitio web
```

### 2.2 Componentes Principales

```
src/components/admin/
├── layout/
│   ├── AdminLayout.tsx           # Layout con navegación
│   ├── admin-shell.tsx           # Shell alternativo
│   └── AdminBreadcrumbs.tsx      # Breadcrumbs
├── users/                        # 11 componentes de gestión de usuarios
├── system/                       # 8 componentes de sistema
├── inventory/                    # 6 componentes de inventario
├── reports/                      # 4 componentes de reportes
└── website/                      # 4 componentes de sitio web
```

---

## 3. Análisis de Seguridad

### 3.1 Vulnerabilidades Críticas

#### 🔴 CRÍTICO #1: Endpoint de Auto-Promoción Sin Validación
**Archivo:** `src/app/api/admin/promote-self/route.ts`

```typescript
export async function POST() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminSupabase()
  
  // ❌ CUALQUIER usuario autenticado puede hacerse admin
  await admin.from('profiles').upsert({
    id: user.id,
    role: 'admin',  // Sin validación previa
    ...
  })
}
```

**Impacto:** Cualquier usuario autenticado puede convertirse en administrador.

**Recomendación:**
```typescript
// Verificar que el usuario actual ya sea admin o que sea el primer usuario
const { count } = await admin.from('profiles')
  .select('*', { count: 'exact', head: true })
  .eq('role', 'admin')

if (count && count > 0) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
}
```

---

#### 🔴 CRÍTICO #2: Falta de AdminGuard Implementado
**Archivo:** `src/components/admin/AdminGuard.test.tsx` (solo test, no implementación)

```typescript
// El test existe pero el componente real NO
const mod = await import('../../modules/admin/components/AdminGuard')
AdminGuard = mod.default
```

**Búsqueda:** No se encontró `AdminGuard.tsx` en el proyecto.

**Impacto:** Las rutas admin no tienen protección en el frontend.

**Recomendación:** Crear el componente:
```typescript
// src/components/admin/AdminGuard.tsx
'use client'

import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/dashboard')
    }
  }, [user, isAdmin, loading, router])

  if (loading) return <div>Cargando...</div>
  if (!user || !isAdmin) return null

  return <>{children}</>
}
```

---

#### 🔴 CRÍTICO #3: Layout Admin Sin Protección
**Archivo:** `src/app/admin/layout.tsx`

```typescript
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayoutProvider>
      <AdminLayout>
        {children}  {/* ❌ Sin AdminGuard */}
      </AdminLayout>
    </AdminLayoutProvider>
  )
}
```

**Recomendación:**
```typescript
import { AdminGuard } from '@/components/admin/AdminGuard'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminLayoutProvider>
        <AdminLayout>
          {children}
        </AdminLayout>
      </AdminLayoutProvider>
    </AdminGuard>
  )
}
```

---

#### ⚠️ ALTO #4: Middleware withAuth Sin Validación de Roles
**Archivo:** `src/lib/api/withAuth.ts`

```typescript
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest) => {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // ❌ Solo verifica autenticación, NO roles
    return await handler(request, context)
  }
}
```

**Recomendación:** Crear `withAdminAuth`:
```typescript
export function withAdminAuth(handler: AuthenticatedHandler) {
  return withAuth(async (request, context) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', context.user.id)
      .single()
    
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    return await handler(request, context)
  })
}
```

---

#### ⚠️ ALTO #5: Importación Masiva de Usuarios Sin Restricciones
**Archivo:** `src/app/api/admin/users/import/route.ts`

```typescript
export async function POST(req: NextRequest) {
  // ❌ No verifica si el usuario actual es admin
  const body = await req.json()
  const users: ImportUser[] = Array.isArray(body?.users) ? body.users : []
  
  // Crea usuarios sin validación de permisos
  for (const u of users) {
    await adminClient.auth.admin.createUser({...})
  }
}
```

**Recomendación:** Usar `withAdminAuth` y validar roles asignados.

---

### 3.2 Políticas RLS (Row Level Security)

#### ✅ Bien Implementadas

```sql
-- Perfiles: usuarios solo ven su propio perfil
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Roles de usuario con RLS habilitado
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
```

#### ⚠️ Requieren Revisión

```sql
-- Función has_permission permite bypass para super_admin
IF user_role = 'super_admin' THEN
  RETURN TRUE;  -- ⚠️ Sin auditoría
END IF;

-- Admin tiene casi todos los permisos excepto system.*
WHEN 'admin' THEN
  RETURN permission_name NOT LIKE 'system.%';
```

**Recomendación:** Agregar auditoría para acciones de super_admin.

---

## 4. Sistema de Permisos

### 4.1 Jerarquía de Roles

```typescript
// src/lib/supabase/setup.sql
role TEXT NOT NULL CHECK (role IN (
  'super_admin',  // Nivel 5 - Acceso total
  'admin',        // Nivel 4 - Casi todo excepto system.*
  'manager',      // Nivel 3 - Gestión operativa
  'employee',     // Nivel 2 - Operaciones básicas
  'viewer'        // Nivel 1 - Solo lectura
))
```

### 4.2 Permisos por Categoría

**Navegación Admin** (`src/config/admin-navigation.ts`):

| Sección | Permisos Requeridos | Roles |
|---------|-------------------|-------|
| Resumen | `[]` (todos los admin) | admin, super_admin |
| Analytics | `analytics.read` | admin+ |
| Inventario | `inventory.read` | admin+ |
| Reportes | `reports.read` | admin+ |
| Usuarios | `users.read` | admin+ |
| Seguridad | `settings.read` | admin+ |
| Configuración | `settings.read` | admin+ |

### 4.3 Filtrado de Navegación

```typescript
// ✅ Bien implementado
export function filterCategoriesByPermissions(
  categories: NavCategory[],
  hasPermission: (permission: string) => boolean,
  isAdmin: boolean
): NavCategory[] {
  return categories
    .map(category => ({
      ...category,
      items: filterNavItemsByPermissions(category.items, hasPermission, isAdmin)
    }))
    .filter(category => category.items.length > 0)
}
```

---

## 5. Componentes de UI

### 5.1 Panel de Seguridad
**Archivo:** `src/components/admin/system/security-panel.tsx`

✅ **Fortalezas:**
- Hook personalizado `useSecurityLogs` para gestión de logs
- Filtros avanzados (severidad, tiempo, usuario, IP)
- Exportación a CSV
- UI con indicadores visuales de severidad
- Soporte para modo oscuro

⚠️ **Áreas de Mejora:**
- No muestra detalles completos del evento (solo snippet)
- Falta paginación para grandes volúmenes
- No hay alertas en tiempo real

### 5.2 Gestión de Usuarios
**Archivo:** `src/components/admin/users/user-management.tsx`

✅ **Fortalezas:**
- Validación de permisos con `isAdmin`
- Componentes modulares (tabla, filtros, diálogos)
- Importación CSV
- Timeline de actividad

⚠️ **Áreas de Mejora:**
```typescript
// Validación solo en frontend
if (!isAdmin) {
  return <div>No tienes permisos</div>
}
```

**Recomendación:** Agregar validación en el servidor.

---

## 6. APIs Admin

### 6.1 Rutas Protegidas

| Ruta | Método | Middleware | Validación Rol |
|------|--------|-----------|----------------|
| `/api/admin/promote-self` | POST | ❌ Ninguno | ❌ No |
| `/api/admin/users/import` | POST | ❌ Ninguno | ❌ No |
| `/api/admin/users/sync` | POST | ❌ Ninguno | ❌ No |
| `/api/admin/setup-storage` | POST | ❌ Ninguno | ⚠️ Comentado |
| `/api/admin/website/settings` | GET | ✅ withAuth | ❌ No valida admin |
| `/api/admin/website/settings/[key]` | PUT | ✅ withAuth | ❌ No valida admin |

### 6.2 Recomendaciones por Ruta

```typescript
// ❌ ANTES
export async function POST() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  // ...
}

// ✅ DESPUÉS
export const POST = withAdminAuth(async (request, { user }) => {
  // user.role ya está validado como admin
  // ...
})
```

---

## 7. Logs y Auditoría

### 7.1 Sistema de Logs

**Tabla:** `audit_log`

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

✅ **Implementado en:**
- Promoción de usuarios a admin
- Cambios en configuración del sitio web

❌ **Falta en:**
- Importación masiva de usuarios
- Cambios en permisos
- Acceso a secciones sensibles
- Exportación de datos

### 7.2 Hook useSecurityLogs

**Archivo:** `src/hooks/use-security-logs.ts` (referenciado pero no auditado)

**Funcionalidades:**
- `fetchSecurityLogs(filters)` - Obtener logs con filtros
- `exportLogsToCSV()` - Exportar a CSV
- `refreshLogs()` - Refrescar datos
- `stats` - Estadísticas agregadas

---

## 8. Contextos y Estado

### 8.1 AuthContext
**Archivo:** `src/contexts/auth-context.tsx`

```typescript
interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean          // ✅ Computed property
  isSuperAdmin: boolean     // ✅ Computed property
  isManager: boolean        // ✅ Computed property
  hasPermission: (permission: string) => boolean
  canManageUser: (targetRole: UserRole) => boolean
}

// ✅ Bien implementado
const isAdmin = user?.role === 'admin'
const isSuperAdmin = user?.role === 'admin'  // En este sistema admin es el más alto
```

### 8.2 AdminLayoutContext
**Archivo:** `src/contexts/AdminLayoutContext.tsx` (referenciado)

**Funcionalidades esperadas:**
- `sidebarCollapsed` - Estado del sidebar
- `toggleSidebar()` - Toggle del sidebar
- `darkMode` - Modo oscuro
- `toggleDarkMode()` - Toggle del modo oscuro

---

## 9. Testing

### 9.1 Tests Existentes

```typescript
// src/components/admin/AdminGuard.test.tsx
describe('AdminGuard', () => {
  it('renders children for admin users', () => {
    // ❌ Test para componente que NO existe
  })
})

// src/test/integration/admin-routes.integration.test.tsx
describe('Rutas Admin bajo AdminLayout', () => {
  // ⚠️ Mock de AdminGuard que no existe
  vi.mock('../../modules/admin/components/AdminGuard', () => ({
    default: ({ children }: any) => <>{children}</>
  }))
})
```

### 9.2 Cobertura de Tests

| Componente | Tests | Cobertura |
|------------|-------|-----------|
| AdminGuard | ❌ Componente no existe | 0% |
| AdminLayout | ❌ No | 0% |
| SecurityPanel | ❌ No | 0% |
| UserManagement | ❌ No | 0% |
| withAuth | ❌ No | 0% |

**Recomendación:** Implementar tests unitarios e integración para componentes críticos.

---

## 10. Recomendaciones Prioritarias

### 10.1 Críticas (Implementar Inmediatamente)

1. **Eliminar o Proteger `/api/admin/promote-self`**
   ```typescript
   // Opción 1: Eliminar completamente
   // Opción 2: Solo permitir si no hay admins
   const { count } = await admin.from('profiles')
     .select('*', { count: 'exact', head: true })
     .eq('role', 'admin')
   
   if (count && count > 0) {
     return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
   }
   ```

2. **Crear e Implementar AdminGuard**
   ```bash
   # Crear archivo
   src/components/admin/AdminGuard.tsx
   
   # Implementar en layout
   src/app/admin/layout.tsx
   ```

3. **Crear Middleware withAdminAuth**
   ```typescript
   // src/lib/api/withAdminAuth.ts
   export function withAdminAuth(handler: AuthenticatedHandler) {
     return withAuth(async (request, context) => {
       // Validar rol admin
       if (!['admin', 'super_admin'].includes(context.user.role)) {
         return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
       }
       return await handler(request, context)
     })
   }
   ```

4. **Proteger Todas las Rutas Admin**
   ```typescript
   // Aplicar withAdminAuth a:
   - /api/admin/users/import
   - /api/admin/users/sync
   - /api/admin/setup-storage
   - /api/admin/website/settings/*
   ```

### 10.2 Altas (Implementar Esta Semana)

5. **Agregar Auditoría Completa**
   - Registrar todas las acciones admin en `audit_log`
   - Incluir IP, user agent, timestamp
   - Alertas para acciones críticas

6. **Implementar Rate Limiting**
   ```typescript
   // Para endpoints sensibles
   - /api/admin/users/import (max 10/hora)
   - /api/admin/promote-self (max 3/día)
   ```

7. **Validación de Roles en Importación**
   ```typescript
   // No permitir crear super_admin via import
   if (u.role === 'super_admin' && context.user.role !== 'super_admin') {
     throw new Error('Cannot create super_admin')
   }
   ```

8. **Tests de Seguridad**
   - Test de escalación de privilegios
   - Test de acceso no autorizado
   - Test de bypass de permisos

### 10.3 Medias (Implementar Este Mes)

9. **Mejorar Panel de Seguridad**
   - Paginación de logs
   - Alertas en tiempo real
   - Detalles expandibles de eventos
   - Gráficos de tendencias

10. **Documentación**
    - Guía de permisos y roles
    - Procedimientos de seguridad
    - Runbook para incidentes

11. **Monitoreo Proactivo**
    - Alertas para intentos de escalación
    - Dashboard de métricas de seguridad
    - Notificaciones por email/Slack

12. **Mejoras de UX**
    - Confirmaciones para acciones destructivas
    - Tooltips explicativos
    - Modo de solo lectura para auditoría

---

## 11. Checklist de Seguridad

### Autenticación y Autorización
- [ ] Implementar AdminGuard en layout
- [ ] Crear withAdminAuth middleware
- [ ] Proteger todas las rutas API admin
- [ ] Eliminar/proteger promote-self endpoint
- [ ] Validar roles en importación de usuarios

### Auditoría y Logs
- [ ] Registrar todas las acciones admin
- [ ] Incluir contexto completo (IP, UA, timestamp)
- [ ] Implementar alertas para acciones críticas
- [ ] Retención de logs por 90 días mínimo

### Testing
- [ ] Tests unitarios para AdminGuard
- [ ] Tests de integración para rutas admin
- [ ] Tests de seguridad (penetration testing)
- [ ] Tests de permisos y roles

### Monitoreo
- [ ] Dashboard de métricas de seguridad
- [ ] Alertas en tiempo real
- [ ] Rate limiting en endpoints sensibles
- [ ] Detección de anomalías

### Documentación
- [ ] Guía de arquitectura admin
- [ ] Matriz de permisos y roles
- [ ] Procedimientos de respuesta a incidentes
- [ ] Changelog de cambios de seguridad

---

## 12. Conclusiones

### Fortalezas
✅ Arquitectura modular y bien organizada  
✅ Sistema de permisos granular con RLS  
✅ UI moderna y accesible  
✅ Componentes reutilizables  
✅ Contextos bien estructurados  

### Debilidades Críticas
❌ Falta de protección en rutas admin  
❌ Endpoint de auto-promoción sin validación  
❌ AdminGuard no implementado  
❌ Middleware sin validación de roles  
❌ Falta de tests de seguridad  

### Riesgo General
**🔴 ALTO** - El sistema está vulnerable a escalación de privilegios y acceso no autorizado.

### Próximos Pasos
1. Implementar las 4 recomendaciones críticas (hoy)
2. Ejecutar tests de penetración
3. Implementar recomendaciones altas (esta semana)
4. Revisión de seguridad completa
5. Plan de monitoreo continuo

---

**Auditor:** Kiro AI  
**Versión:** 1.0  
**Última Actualización:** 15 de febrero de 2026
