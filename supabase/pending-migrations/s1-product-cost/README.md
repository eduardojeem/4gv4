# S1 — artefactos de protección de costos

Estos archivos se mantienen fuera de `supabase/migrations/` para que `db push` y la integración Supabase/GitHub no los apliquen automáticamente a una rama. Su presencia aquí no indica el estado actual de una base de datos: comprobar el historial y los objetos remotos mediante el procedimiento aprobado antes de cualquier operación.

El orden de despliegue definido para S1 fue: `01` → `04` (S1b) → `02` → desplegar la web compatible → `03`. Ese orden no constituye un procedimiento de rollback. No ejecutar archivos de esta carpeta en producción sin autorización humana específica.

## `rollback_03.sql` es una recuperación restrictiva, no un rollback

El nombre se conserva por compatibilidad con referencias existentes. El SQL vuelve a imponer ACL restrictivas después de 03. **No restaura `SELECT` directo de las columnas de costo para `anon` ni `authenticated`, no devuelve la base al estado inseguro anterior a 03 y no revierte S1.** No ejecutarlo automáticamente.

Su uso requiere autorización humana y una evaluación del incidente concreto. La recuperación real debe elegirse según el síntoma y el estado verificado; no se debe inferir que este archivo revierte la migración 03 ni ejecutar otros rollbacks en cadena.

Diseño, pruebas y procedimiento: [docs/security/s1-product-cost-column-security.md](../../../docs/security/s1-product-cost-column-security.md).

## Material de apoyo

- `verify_s1b.sql`: verificación previa/posterior de solo lectura y metadatos.
- `rollback_01_triggers_only.sql`: retira la protección de escritura sin cambiar S1b; requiere evaluación y autorización propias.
- `recovery_04_targeted.sql`: correcciones puntuales que no devuelven acceso al rol `customer`; requiere evaluación y autorización propias.
- `../../tests/s1b_postdeploy_dataapi.mjs`: conteos de Data API con una cuenta de prueba aprobada.

La sección 12 del documento de diseño describe el procedimiento de S1b. Es documentación operativa, no autorización para ejecutarlo.
