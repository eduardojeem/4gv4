# Fix: Error en Registro de Sesiones

**Fecha**: 15 de febrero de 2026  
**Estado**: ✅ Mejorado manejo de errores

---

## Error Reportado

```
❌ Error registering session: {}
at useSessionTracking.useCallback[registerSession]
```

---

## Problema

El hook `use-session-tracking.ts` intenta registrar sesiones de usuario en la tabla `user_sessions`, pero está recibiendo un error vacío `{}` de Supabase, lo que indica un problema con la tabla o los permisos.

---

## Causa Probable

El error vacío `{}` de Supabase generalmente indica uno de estos problemas:

1. **Tabla no existe**: La tabla `user_sessions` no está creada en Supabase
2. **Permisos RLS**: Row Level Security está bloqueando la operación
3. **Columnas faltantes**: La tabla existe pero le faltan columnas
4. **Política RLS incorrecta**: Las políticas no permiten INSERT/UPSERT

---

## Solución Implementada

### 1. Mejorado Manejo de Errores

**Antes:**
```typescript
if (error) {
  const msg = (error as any)?.message || (error as any)?.hint || (error as any)?.details || 'Unknown error'
  console.warn('❌ Error registering session:', msg)
}
```

**Ahora:**
```typescript
if (error) {
  const msg = (error as any)?.message || (error as any)?.hint || (error as any)?.details || JSON.stringify(error) || 'Unknown error'
  console.warn('❌ Error registering session:', msg)
  console.warn('Full error object:', error)
}
```

**Mejoras:**
- ✅ Agregado `JSON.stringify(error)` para capturar errores vacíos
- ✅ Agregado log del objeto completo para debugging
- ✅ Mejor información para diagnosticar el problema

---

## Soluciones para el Usuario

### Opción 1: Crear la Tabla (Recomendado)

Si la tabla no existe, crear en Supabase SQL Editor:

```sql
-- Crear tabla de sesiones de usuario
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

-- Habilitar RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver sus propias sesiones
CREATE POLICY "Users can view own sessions"
  ON user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Los usuarios pueden insertar sus propias sesiones
CREATE POLICY "Users can insert own sessions"
  ON user_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden actualizar sus propias sesiones
CREATE POLICY "Users can update own sessions"
  ON user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Los admins pueden ver todas las sesiones
CREATE POLICY "Admins can view all sessions"
  ON user_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

### Opción 2: Deshabilitar Tracking de Sesiones

Si no necesitas esta funcionalidad, puedes deshabilitarla:

**Archivo**: `src/hooks/use-session-tracking.ts`

```typescript
// Al inicio del hook, agregar:
const ENABLE_SESSION_TRACKING = false

// En registerSession:
const registerSession = useCallback(async () => {
  if (!ENABLE_SESSION_TRACKING) return  // ✅ Deshabilitar
  
  try {
    // ... resto del código
  }
}, [supabase])
```

### Opción 3: Hacer el Tracking Opcional

Envolver el hook en un try-catch para que no afecte la app:

**Archivo donde se usa el hook**

```typescript
try {
  useSessionTracking()
} catch (error) {
  console.warn('Session tracking disabled:', error)
}
```

---

## Verificación de la Tabla

### 1. Verificar si la tabla existe

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_sessions'
);
```

### 2. Verificar columnas

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_sessions'
ORDER BY ordinal_position;
```

### 3. Verificar políticas RLS

```sql
SELECT * FROM pg_policies 
WHERE tablename = 'user_sessions';
```

### 4. Verificar permisos

```sql
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'user_sessions';
```

---

## Datos que se Intentan Guardar

```typescript
{
  session_id: string,        // ID único de la sesión
  user_id: string,           // UUID del usuario
  ip_address: string,        // IP del cliente
  user_agent: string,        // User agent del navegador
  device: string,            // Tipo de dispositivo
  browser: string,           // Navegador
  os: string,                // Sistema operativo
  country: string,           // País (de geolocalización)
  city: string,              // Ciudad (de geolocalización)
  is_active: boolean,        // Si la sesión está activa
  last_activity: string      // Última actividad (ISO timestamp)
}
```

---

## Archivos Modificados

```
src/hooks/use-session-tracking.ts
```

**Cambios:**
1. Mejorado manejo de errores vacíos
2. Agregado log del objeto completo de error
3. Agregado `JSON.stringify(error)` como fallback

---

## Testing

### Verificar el Error

1. ✅ Abrir DevTools (F12)
2. ✅ Ir a Console
3. ✅ Buscar mensajes de "Error registering session"
4. ✅ Verificar que ahora muestra más información

### Verificar la Tabla

1. ✅ Ir a Supabase Dashboard
2. ✅ Table Editor
3. ✅ Buscar tabla `user_sessions`
4. ✅ Si no existe, crearla con el SQL de arriba

### Verificar Políticas RLS

1. ✅ Ir a Authentication → Policies
2. ✅ Buscar políticas de `user_sessions`
3. ✅ Verificar que permiten INSERT y UPDATE

---

## Impacto del Error

### Funcionalidad Afectada

- ❌ No se registran sesiones de usuario
- ❌ No se puede rastrear actividad
- ❌ No se puede ver historial de sesiones

### Funcionalidad NO Afectada

- ✅ Login funciona normalmente
- ✅ Autenticación funciona
- ✅ Dashboard funciona
- ✅ Todas las demás funciones del sistema

**Conclusión**: El error no es crítico, solo afecta el tracking de sesiones.

---

## Recomendaciones

### Corto Plazo

1. ✅ Crear la tabla `user_sessions` con el SQL proporcionado
2. ✅ Verificar que las políticas RLS están correctas
3. ✅ Probar que el registro de sesiones funciona

### Largo Plazo

1. **Agregar Validación**: Verificar que la tabla existe antes de intentar guardar
2. **Fallback Graceful**: Si falla, no mostrar error al usuario
3. **Configuración**: Hacer el tracking opcional via variable de entorno
4. **Monitoring**: Agregar alertas si el tracking falla consistentemente

---

## Código de Validación (Opcional)

Agregar al inicio del hook para verificar que la tabla existe:

```typescript
const [tableExists, setTableExists] = useState<boolean | null>(null)

useEffect(() => {
  const checkTable = async () => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .select('id')
        .limit(1)
      
      setTableExists(!error)
    } catch {
      setTableExists(false)
    }
  }
  
  checkTable()
}, [supabase])

// En registerSession:
if (!tableExists) {
  console.warn('Session tracking disabled: table does not exist')
  return
}
```

---

## Variables de Entorno (Opcional)

Agregar a `.env.local`:

```env
# Session Tracking
NEXT_PUBLIC_ENABLE_SESSION_TRACKING=true
```

Usar en el código:

```typescript
const ENABLE_TRACKING = process.env.NEXT_PUBLIC_ENABLE_SESSION_TRACKING === 'true'

if (!ENABLE_TRACKING) return
```

---

## Conclusión

✅ Mejorado el manejo de errores para obtener más información sobre el problema. El error indica que la tabla `user_sessions` probablemente no existe o tiene problemas de permisos RLS. La solución recomendada es crear la tabla con el SQL proporcionado. El error no es crítico y no afecta la funcionalidad principal del sistema.
