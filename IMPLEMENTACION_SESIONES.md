# Implementación del Sistema de Seguimiento de Sesiones

Este sistema permite rastrear todas las sesiones activas de un usuario en diferentes dispositivos y navegadores.

## 🚀 Pasos de Implementación

### 1. Ejecutar las Migraciones de Base de Datos

Ejecuta las siguientes migraciones en tu base de datos de Supabase:

```bash
# En Supabase Dashboard > SQL Editor, ejecuta:
supabase/migrations/20260119_user_sessions_tracking.sql
```

Esta migración crea:
- Tabla `user_sessions` para almacenar todas las sesiones
- Funciones RPC para gestionar sesiones
- Políticas RLS para seguridad
- Índices para optimizar consultas

### 2. Agregar el Provider de Tracking de Sesiones

Envuelve tu aplicación con el `SessionTrackingProvider` en tu layout principal:

```tsx
// src/app/layout.tsx o src/app/dashboard/layout.tsx
import { SessionTrackingProvider } from '@/components/providers/session-tracking-provider'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SessionTrackingProvider>
      {children}
    </SessionTrackingProvider>
  )
}
```

### 3. Verificar la Implementación

1. **Inicia sesión en diferentes dispositivos/navegadores**
   - Abre la aplicación en tu computadora
   - Abre la aplicación en tu móvil
   - Abre la aplicación en otro navegador

2. **Ve a tu perfil > Seguridad**
   - Deberías ver todas las sesiones activas
   - Cada sesión muestra:
     - Tipo de dispositivo (Móvil/Tablet/Escritorio)
     - Navegador
     - Sistema operativo
     - IP
     - Última actividad

3. **Prueba cerrar sesiones**
   - Cierra una sesión específica desde otro dispositivo
   - Cierra todas las sesiones excepto la actual

## 📋 Características

### Seguimiento Automático
- ✅ Registra automáticamente cada inicio de sesión
- ✅ Actualiza la actividad cada 5 minutos
- ✅ Detecta actividad del usuario (clicks, teclas, scroll)
- ✅ Cierra sesiones inactivas después de 7 días

### Información de Sesión
- 🖥️ Tipo de dispositivo (móvil, tablet, escritorio)
- 🌐 Navegador utilizado
- 💻 Sistema operativo
- 📍 Dirección IP
- ⏰ Última actividad
- ✅ Estado (activa/cerrada)

### Gestión de Sesiones
- 🔒 Cerrar sesión específica
- 🚪 Cerrar todas las sesiones excepto la actual
- 🔄 Actualización en tiempo real
- 🔐 Seguridad con RLS (Row Level Security)

## 🔧 Funciones RPC Disponibles

### `get_user_active_sessions(p_user_id UUID)`
Obtiene todas las sesiones activas de un usuario.

```sql
SELECT * FROM get_user_active_sessions('user-uuid-here');
```

### `close_user_session(p_session_id TEXT, p_user_id UUID)`
Cierra una sesión específica.

```sql
SELECT close_user_session('session-id-here', 'user-uuid-here');
```

### `close_all_user_sessions_except_current(p_user_id UUID, p_current_session_id TEXT)`
Cierra todas las sesiones de un usuario excepto la actual.

```sql
SELECT close_all_user_sessions_except_current('user-uuid-here', 'current-session-id');
```

### `close_inactive_sessions()`
Cierra automáticamente sesiones inactivas (más de 7 días).

```sql
SELECT close_inactive_sessions();
```

## 🔐 Seguridad

- **RLS Habilitado**: Los usuarios solo pueden ver sus propias sesiones
- **Políticas de Seguridad**: 
  - SELECT: Solo sesiones propias
  - UPDATE: Solo sesiones propias
  - DELETE: Solo sesiones propias
  - INSERT: Sistema puede insertar

## 📊 Tabla `user_sessions`

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);
```

## 🎯 Próximas Mejoras

- [ ] Agregar geolocalización (país, ciudad)
- [ ] Notificaciones de inicio de sesión desde nuevo dispositivo
- [ ] Historial de sesiones cerradas
- [ ] Exportar historial de sesiones
- [ ] Alertas de actividad sospechosa
- [ ] Límite de sesiones simultáneas

## 🐛 Troubleshooting

### Las sesiones no se registran
1. Verifica que las migraciones se ejecutaron correctamente
2. Revisa la consola del navegador para errores
3. Verifica que el `SessionTrackingProvider` esté en el layout

### No veo sesiones de otros dispositivos
1. Asegúrate de haber iniciado sesión en esos dispositivos
2. Espera unos segundos para que se registre la sesión
3. Refresca la página de perfil

### Error al cerrar sesiones
1. Verifica que las funciones RPC existan en Supabase
2. Revisa los permisos RLS
3. Verifica que el usuario tenga permisos

## 📝 Notas

- Las sesiones se actualizan automáticamente cada 5 minutos
- Las sesiones inactivas por más de 7 días se cierran automáticamente
- El sistema usa parte del access_token como identificador único de sesión
- La información de IP puede no estar disponible en desarrollo local
