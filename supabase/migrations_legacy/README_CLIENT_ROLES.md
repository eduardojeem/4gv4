# Configuración de Roles de Cliente

Se ha creado el script `setup_client_roles_and_defaults.sql` para manejar la gestión de roles de clientes.

## Características

1. **Nuevos Roles Definidos:**
   - `client_normal`: Rol por defecto para nuevos registros.
   - `client_mayorista`: Rol para clientes mayoristas (debe asignarse manualmente o por lógica de negocio).

2. **Automatización (Trigger):**
   - Cada vez que un usuario se registra en Supabase (auth.users), automáticamente se le asigna el rol `client_normal`.
   - Se actualiza su `user_metadata` para incluir `role: 'client_normal'`.
   - Se crea/actualiza su entrada en `user_roles`.

3. **Corrección de Usuarios Existentes:**
   - El script busca usuarios que no tengan rol asignado y les asigna `client_normal`.
   - **IMPORTANTE:** Si existen usuarios con roles inválidos (que no estén en la lista permitida), se actualizarán automáticamente a `client_normal` para evitar errores.

## Instrucciones de Ejecución

1. Ir al **SQL Editor** en Supabase Dashboard.
2. Copiar el contenido de `supabase/migrations/setup_client_roles_and_defaults.sql`.
3. Ejecutar el script.

## Verificación

Para verificar que funciona:
1. Ejecuta el script.
2. Crea un nuevo usuario desde tu aplicación.
3. Revisa la tabla `user_roles` o `auth.users`, el nuevo usuario debería tener `client_normal`.
