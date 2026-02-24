# User Registration Automation

## Descripción

Este documento describe la automatización implementada para el proceso de registro de usuarios en el sistema. Cuando un usuario se registra, automáticamente se crean registros en las tablas `profiles` y `customers`, asegurando una integración completa entre el sistema de autenticación y la gestión de clientes.

## ¿Qué se automatiza?

Cuando un usuario se registra a través del formulario de registro (`/register`):

1. **Se crea el usuario en `auth.users`** (proceso estándar de Supabase)
2. **Se ejecuta el trigger `on_auth_user_created`**
3. **Se crea el perfil en `profiles`** con rol 'cliente' por defecto
4. **Se crea el cliente en `customers`** vinculado al perfil
5. **Se actualiza la interfaz de administración** (`/admin/users`) con el nuevo usuario
6. **Se actualiza el dashboard de clientes** (`/dashboard/customers`) con el nuevo cliente

## Tablas involucradas

### 1. Tabla `auth.users`
- **Propósito**: Almacena las credenciales de autenticación
- **Trigger**: `on_auth_user_created` (AFTER INSERT)

### 2. Tabla `profiles`
- **Propósito**: Almacena información del perfil del usuario
- **Campos principales**: `id`, `email`, `full_name`, `role`
- **Rol por defecto**: 'cliente'

### 3. Tabla `customers`
- **Propósito**: Almacena información del cliente para el sistema de ventas
- **Campos principales**: `id`, `profile_id`, `name`, `first_name`, `last_name`, `email`, `customer_type`, `segment`
- **Vinculación**: `profile_id` → `profiles.id`
- **Nota**: Se agregaron las columnas `first_name` y `last_name` para mejor integración.

## Funciones de base de datos

### `handle_new_user()`
```sql
-- Función principal que se ejecuta cuando se crea un nuevo usuario
-- Crea el perfil y el cliente automáticamente
-- Maneja errores y evita duplicados
```

### `sync_profile_to_customer()`
```sql
-- Función que mantiene sincronizados los cambios entre profiles y customers
-- Se ejecuta en UPDATE de role, full_name, email, phone
```

## Flujo de trabajo

```
Usuario se registra → Trigger ejecutado → Perfil creado → Cliente creado → Sincronización activa
```

## Beneficios

1. **Sin intervención manual**: Los usuarios se convierten automáticamente en clientes
2. **Datos consistentes**: Perfiles y clientes siempre están sincronizados
3. **Gestión unificada**: Un solo punto de entrada para administración de usuarios
4. **Rendimiento optimizado**: Triggers eficientes con manejo de errores

## Verificación

Para verificar que la automatización funciona correctamente:

### Opción 1: Prueba manual
1. Registrar un nuevo usuario en `/register`
2. Verificar que aparece en `/admin/users`
3. Verificar que aparece en `/dashboard/customers`

### Opción 2: Prueba con script SQL
```bash
# Ejecutar el script de prueba
psql -d your_database -f scripts/test-user-registration-automation.sql
```

### Opción 3: Prueba con JavaScript
```javascript
// En la consola del navegador
testRegistration();
```

## Solución de problemas

### Error: "infinite recursion detected"
Este error ocurre cuando una política de seguridad intenta leer la misma tabla que está protegiendo.
**Solución**: Se ha implementado un sistema basado en JWT para evitar esto. Si persiste:
1. **Cerrar sesión e iniciar sesión nuevamente**. Esto actualiza los permisos en el token.
2. Verificar que las políticas no hagan `SELECT` a `profiles` dentro de `profiles`.

### Si el usuario no aparece en clientes:
1. Verificar logs de Supabase
2. Revisar triggers: `SELECT * FROM pg_trigger WHERE tgname LIKE '%user%';`
3. Verificar funciones: `SELECT proname FROM pg_proc WHERE proname LIKE '%user%';`
4. **Verificar permisos de secuencia**: `GRANT USAGE ON SEQUENCE customer_code_seq TO authenticated;` (Crucial)

### Si hay errores de permisos:
```sql
-- Asegurar permisos necesarios
GRANT INSERT ON customers TO authenticated;
GRANT SELECT ON customers TO authenticated;
GRANT USAGE ON SEQUENCE customer_code_seq TO authenticated;
```

## Mantenimiento

La automatización está diseñada para ser autónoma. Sin embargo, para actualizaciones:

1. **Modificar funciones**: Actualizar las funciones en `supabase/migrations/`
2. **Agregar campos**: Modificar las tablas y actualizar las funciones
3. **Cambiar lógica**: Considerar impacto en datos existentes

## Archivos relevantes

- `supabase/migrations/20260223_fix_recursion_final.sql` - Corrección final de recursión infinita
- `supabase/migrations/20260223_fix_permissions_and_backfill.sql` - Corrección de permisos y backfill
- `supabase/migrations/20260223_fix_registration_error.sql` - Corrección de error y adición de columnas
- `supabase/migrations/20260223_fix_user_registration_automation.sql` - Migración inicial
- `src/app/register/page.tsx` - Formulario de registro
- `scripts/test-user-registration-automation.sql` - Script de prueba SQL
