# Guía de Diagnóstico: Sesiones No Se Muestran

## 🔍 Pasos para Diagnosticar

### 1. Verificar la Consola del Navegador

Abre la consola del navegador (F12) y busca los siguientes logs:

**Al cargar la página:**
- `📝 Registering session for user: <user-id>` - La sesión se está intentando registrar
- `🌍 Session info:` - Información del dispositivo
- `💾 Attempting to save session:` - Datos que se intentan guardar
- `✅ Session registered successfully!` - Registro exitoso
- `❌ Error registering session:` - Error al registrar

**Al ir a la sección de Seguridad:**
- `🔍 Loading sessions for user: <user-id>` - Iniciando carga
- `✅ Sessions from database:` - Datos devueltos por la base de datos
- `🔑 Current session ID:` - ID de la sesión actual
- `📊 Mapped sessions:` - Sesiones procesadas para mostrar

### 2. Verificar la Base de Datos

Ejecuta el archivo [debug_sessions.sql](file:///c:/Users/4g/Desktop/4g/4g3/4gv4/supabase/debug_sessions.sql) en Supabase SQL Editor:

1. Ve a tu proyecto de Supabase
2. Abre el SQL Editor
3. Copia y pega las queries del archivo
4. Ejecuta cada query una por una

**Queries importantes:**

- Query #2: Verifica si hay sesiones en la tabla
- Query #3: Cuenta sesiones por usuario
- Query #4: Verifica que la función RPC existe
- Query #6: Revisa las políticas de seguridad

### 3. Errores Comunes

#### **Error: "relation 'user_sessions' does not exist"**
**Solución:** La migración no se ha ejecutado. Ejecuta:
\`\`\`bash
supabase/migrations/20260119_user_sessions_tracking.sql
\`\`\`

#### **Error: "function get_user_active_sessions does not exist"**
**Solución:** La función RPC no existe. Verifica que la migración se ejecutó correctamente.

#### **Error: "permission denied for table user_sessions"**
**Solución:** Las políticas RLS no están configuradas correctamente. Re-ejecuta la migración.

#### **Error: "No sessions found" pero hay sesiones en la tabla**
**Solución:** El `user_id` puede no coincidir. Verifica en la consola el user_id que se está usando.

### 4. Probando desde Otro Dispositivo

Para probar que las sesiones de múltiples dispositivos funcionan:

1. **Dispositivo 1 (Principal):**
   - Abre la consola del navegador
   - Ve a `/dashboard/profile` y luego a la pestaña "Seguridad"
   - Anota el `session_id` que aparece en la consola

2. **Dispositivo 2 (Móvil/Tablet/Otra computadora):**
   - Inicia sesión con la misma cuenta
   - Espera unos segundos para que se registre la sesión
   - Ve a la consola (si es posible) y verifica: `✅ Session registered successfully!`

3. **De vuelta en Dispositivo 1:**
   - Haz clic en "Actualizar" en la sección de Sesiones
   - Deberías ver 2 sesiones ahora

### 5. Verificación Manual en Base de Datos

Si las sesiones no aparecen, ejecuta esta query en Supabase SQL Editor:

\`\`\`sql
SELECT 
  session_id,
  device_type,
  browser,
  os,
  city,
  country,
  is_active,
  last_activity,
  created_at
FROM user_sessions
WHERE user_id = auth.uid()
  AND is_active = true
ORDER BY last_activity DESC;
\`\`\`

Esto mostrará todas tus sesiones activas directamente desde la base de datos.

### 6. Solución Rápida: Forzar Re-registro

Si las sesiones no se están registrando automáticamente:

1. Cierra todas las pestañas del dashboard
2. Limpia las cookies del sitio
3. Vuelve a iniciar sesión
4. Ve a la consola y verifica que aparezca: `✅ Session registered successfully!`

## 🐛 Posibles Problemas Identificados

### Problema 1: Geolocalización Lenta
La llamada a `ipapi.co` puede tardar varios segundos. Esto podría hacer que el registro de la sesión se retrase o falle.

**Indicador:** En la consola ves `📝 Registering session` pero no ves `🌍 Session info:` inmediatamente.

**Solución temporal:** Comentar la geolocalización temporalmente para verificar si ese es el problema.

### Problema 2: CORS en ipapi.co
Si ves errores de CORS en la consola relacionados con `ipapi.co`.

**Solución:** La geolocalización fallará silenciosamente pero la sesión debería registrarse sin ubicación.

### Problema 3: RLS Bloqueando Inserts
Si ves `❌ Error registering session: new row violates row-level security policy`

**Solución:** La política RLS de INSERT necesita ajuste. Ejecuta:
\`\`\`sql
DROP POLICY IF EXISTS "System can insert sessions" ON user_sessions;
CREATE POLICY "Users can insert their own sessions"
  ON user_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
\`\`\`

## 📝 Reportar el Problema

Si ninguna de estas soluciones funciona, proporciona la siguiente información:

1. Captura de pantalla de la consola del navegador (con todos los logs)
2. Resultado de ejecutar Query #2 y #3 de debug_sessions.sql
3. ¿Ves algún error en rojo en la consola?
4. ¿Cuántas sesiones debería mostrar? (¿tienes sesión abierta en cuántos dispositivos?)
