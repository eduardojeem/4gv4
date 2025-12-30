# Asignar Rol de Técnico - Guía de Ejecución

## Script SQL Creado

Se ha creado el archivo `add_technician_role_john.sql` en `supabase/migrations/`

## Pasos para Ejecutar

### Opción 1: Desde Supabase Dashboard (Recomendado)

1. **Acceder a Supabase Dashboard:**
   - Ir a [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Seleccionar tu proyecto

2. **Abrir SQL Editor:**
   - En el menú lateral, click en "SQL Editor"
   - Click en "New query"

3. **Ejecutar el script:**
   - Copiar el contenido del archivo `add_technician_role_john.sql`
   - Pegar en el editor
   - Click en "Run" o presionar `Ctrl+Enter`

4. **Verificar resultados:**
   - El último SELECT mostrará el usuario con su rol actualizado
   - Debe mostrar `technician` en las columnas de rol

### Opción 2: Desde CLI de Supabase

```bash
# Si tienes Supabase CLI instalado
cd c:\Users\4g\Desktop\4g\4g3\4gv4
supabase db push
```

### Opción 3: Aplicar Migración

```bash
# Ejecutar la migración específica
supabase migration up --file supabase/migrations/add_technician_role_john.sql
```

## Verificación

Después de ejecutar, verifica que el usuario ahora tiene acceso de técnico:

1. Pide al usuario que cierre sesión y vuelva a iniciar sesión
2. Debería ver las opciones/vistas correspondientes al rol de técnico
3. En `/dashboard/repairs/technicians` debería aparecer listado

## Rollback (Si es necesario)

Si necesitas revertir el cambio:

```sql
-- Eliminar rol de técnico
DELETE FROM public.user_roles 
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email = 'johneduardoespinoza95@gmail.com'
);

-- Actualizar metadata
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE email = 'johneduardoespinoza95@gmail.com';
```

## Notas

- El script es idempotente (se puede ejecutar múltiples veces sin problemas)
- Usa `ON CONFLICT DO UPDATE` para manejar usuarios existentes
- Actualiza todas las tablas relevantes (user_roles, metadata, profiles)
- Incluye verificación al final para confirmar el cambio

## Siguientes Pasos

Una vez aplicado el rol:
1. El usuario verá la sección de técnicos en el dashboard
2. Podrá ser asignado a reparaciones
3. Aparecerá en la lista de técnicos disponibles
4. Tendrá acceso a `/dashboard/technician` si esa ruta existe
