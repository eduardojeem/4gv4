# Aislamiento privado por organización

## Regla de seguridad

Toda superficie privada resuelve la organización activa en el servidor a partir de la sesión, la membresía activa y la cookie validada. Un `organizationId` enviado por el navegador nunca otorga acceso.

Las consultas operativas aplican dos alcances independientes:

1. `organization_id = activeOrganizationId` es obligatorio.
2. `branch_id` es opcional y solo se acepta después de comprobar que pertenece a la organización y que el usuario puede acceder a ella.

Seleccionar “todas las sucursales” elimina únicamente el segundo filtro. Nunca elimina el filtro de organización.

## Barreras implementadas

- `GET /api/organization-context` expone el tenant validado a los layouts privados.
- `ActiveOrganizationProvider` mantiene el contexto en memoria y lo actualiza tras `organization:changed`; no usa `localStorage` como autoridad.
- Dashboard, créditos, usuarios, catálogo, inventario, reportes, ventas, clientes, caja y agenda técnica agregan el tenant antes de otros filtros.
- Las tablas hijas sin `organization_id` se consultan mediante IDs padre previamente acotados, por ejemplo cuotas por créditos, ítems por ventas y alertas por cierres de caja.
- `credit_installments_progress` usa `security_invoker = true`, incluye `organization_id` y depende de RLS en las tablas base.
- Las políticas históricas `TO authenticated USING (true)` conocidas se eliminan en la migración de endurecimiento.

## Verificación antes de desplegar

1. Aplicar `supabase/migrations/20260830151349_harden_private_tenant_isolation.sql` primero en staging.
2. Consultar `pg_policies` y revisar las tablas operativas. No debe existir una política autenticada e incondicional.
3. Autenticar un miembro de la organización A e intentar leer IDs conocidos de B en Dashboard, Créditos, Usuarios, Productos, Reportes y Caja. El resultado esperado es lista vacía, `403` o `404`.
4. Probar una sucursal de B desde A. Debe devolver `403` sin revelar datos de la sucursal.
5. Probar `branch=all`. Debe sumar todas las sucursales de A y ninguna fila de B.

Consulta orientativa para políticas:

```sql
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'products', 'categories', 'customers', 'sales', 'repairs',
    'cash_registers', 'cash_closures', 'cash_movements',
    'customer_credits', 'credit_installments', 'credit_payments'
  )
order by tablename, policyname;
```

## Rollback seguro

- Revertir consumidores o providers por commit si una interfaz falla.
- No restaurar políticas `USING (true)` para resolver errores de permisos.
- Si la vista de cuotas falla, revocar temporalmente su `SELECT` a `authenticated`; no recrearla como `security_definer`.
- La migración no elimina datos históricos. Un rollback de código no debe borrar ni reasignar filas.

## Limitaciones de validación local

`supabase db lint --local` requiere Docker y el stack local en el puerto 54322. Si no está disponible, la sintaxis y las políticas deben validarse en staging antes de producción. Las pruebas estáticas del repositorio comprueban el contrato, pero no sustituyen una prueba autenticada con dos tenants reales.
