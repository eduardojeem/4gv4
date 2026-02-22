# Fix: Problema al Guardar Cambios en Edición de Marcas

## Problema Identificado

Los cambios en la edición de marcas en `/dashboard/brands` no se están guardando correctamente.

## Causas Identificadas

1. **Manejo incorrecto de valores nulos**: El formulario enviaba `undefined` en lugar de `null` para campos opcionales vacíos
2. **Validación de nombres duplicados**: La consulta de verificación no excluía correctamente el ID de la marca actual
3. **Políticas RLS potencialmente conflictivas**: Pueden existir múltiples políticas que se contradicen

## Soluciones Implementadas

### 1. Corrección en BrandModal.tsx

Se mejoró el método `handleSubmit` para:
- Limpiar correctamente los valores antes de enviar
- Convertir strings vacíos a `null` explícitamente
- Hacer trim de todos los campos de texto
- Agregar logs de consola para debugging

```typescript
const dataToSend: BrandInsert = {
  name: formData.name.trim(),
  description: formData.description?.trim() || null,
  website: formData.website?.trim() || null,
  country: formData.country || null,
  founded_year: formData.founded_year || null,
  is_active: formData.is_active ?? true
}
```

### 2. Corrección en useBrands.ts

Se mejoró el método `updateBrand` para:
- Excluir correctamente el ID actual al verificar nombres duplicados usando `.neq('id', id)`
- Agregar más logs de consola para debugging
- Manejar errores de forma más explícita

### 3. Script de Corrección de Políticas RLS

Se creó `scripts/fix-brands-rls-policies.sql` que:
- Elimina políticas conflictivas
- Crea políticas claras y específicas para cada operación (SELECT, INSERT, UPDATE, DELETE)
- Asegura que usuarios con rol `vendedor`, `admin` o `super_admin` puedan editar marcas

## Pasos para Aplicar la Solución

### Paso 1: Verificar los Cambios en el Código

Los archivos ya fueron actualizados:
- ✅ `src/components/dashboard/brands/BrandModal.tsx`
- ✅ `src/hooks/useBrands.ts`

### Paso 2: Aplicar las Políticas RLS (IMPORTANTE)

Ejecuta el script SQL en tu base de datos Supabase:

```bash
# Opción 1: Desde el Dashboard de Supabase
# 1. Ve a SQL Editor en tu proyecto Supabase
# 2. Copia y pega el contenido de scripts/fix-brands-rls-policies.sql
# 3. Ejecuta el script

# Opción 2: Usando la CLI de Supabase (si la tienes instalada)
supabase db execute -f scripts/fix-brands-rls-policies.sql
```

### Paso 3: Verificar Permisos del Usuario

Asegúrate de que tu usuario tenga uno de estos roles:
- `admin`
- `super_admin`
- `vendedor`

O que tenga el permiso:
- `inventory.manage`
- `products.manage`

Puedes verificar esto en la tabla `profiles`:

```sql
SELECT id, email, role, permissions 
FROM profiles 
WHERE email = 'tu-email@ejemplo.com';
```

### Paso 4: Probar la Funcionalidad

1. Abre la consola del navegador (F12)
2. Ve a `/dashboard/brands`
3. Intenta editar una marca
4. Observa los logs en la consola:
   - "Updating brand: [id] [data]"
   - "Sending update to Supabase: [data]"
   - "Update successful: [result]" o errores si los hay

## Debugging Adicional

Si el problema persiste, ejecuta el script de diagnóstico:

```bash
npm install dotenv @supabase/supabase-js
npx tsx scripts/debug-brands-update.ts
```

Este script verificará:
- ✅ Autenticación del usuario
- ✅ Rol y permisos del usuario
- ✅ Acceso de lectura a la tabla brands
- ✅ Acceso de escritura a la tabla brands
- ✅ Políticas RLS activas

## Verificación de Éxito

Después de aplicar las correcciones, deberías poder:
1. ✅ Editar el nombre de una marca
2. ✅ Editar la descripción
3. ✅ Cambiar el país de origen
4. ✅ Modificar el año de fundación
5. ✅ Actualizar el sitio web
6. ✅ Activar/desactivar marcas
7. ✅ Ver los cambios reflejados inmediatamente en la lista

## Errores Comunes y Soluciones

### Error: "Ya existe otra marca con este nombre"
- **Causa**: Intentas cambiar el nombre a uno que ya existe
- **Solución**: Usa un nombre diferente

### Error: "new row violates row-level security policy"
- **Causa**: El usuario no tiene permisos suficientes
- **Solución**: Ejecuta el script `fix-brands-rls-policies.sql` y verifica el rol del usuario

### Error: "null value in column 'name' violates not-null constraint"
- **Causa**: El nombre está vacío
- **Solución**: Ya está validado en el frontend, pero verifica que el campo no esté vacío

### Los cambios no se reflejan en la UI
- **Causa**: El `fetchBrands()` no se está ejecutando después del update
- **Solución**: Ya está implementado en el código actualizado

## Archivos Modificados

- `src/components/dashboard/brands/BrandModal.tsx` - Corrección del manejo de datos
- `src/hooks/useBrands.ts` - Corrección de la lógica de actualización
- `scripts/fix-brands-rls-policies.sql` - Script para corregir políticas RLS
- `scripts/debug-brands-update.ts` - Script de diagnóstico

## Próximos Pasos

Si después de aplicar estas correcciones el problema persiste:
1. Ejecuta el script de diagnóstico
2. Revisa los logs de la consola del navegador
3. Verifica los logs de Supabase en el Dashboard
4. Comparte los mensajes de error específicos para más ayuda
