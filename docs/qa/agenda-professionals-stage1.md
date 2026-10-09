# Reservas por profesional — SQL y aceptación

## Estado

Las migraciones `20261014120001` a `20261014120004` fueron aplicadas por el usuario. No repetirlas. La interfaz avanzada requiere versión 3 para activar la cadena completa de reservas y cobro, incluida la aceptación vinculada a precio, duración y margen.

La revisión independiente está completada y sus dos hallazgos fueron corregidos. La aceptación de staging y producción sigue pendiente. Orden histórico de aplicación (ya completado; no repetir):

1. `supabase/migrations/20261014120002_agenda_booking_atomic.sql`: cotizaciones, reservas idempotentes, horarios, ausencias y edición transaccional.
2. `supabase/migrations/20261014120003_agenda_pos_snapshot.sql`: cobro con tarifa acordada y vínculo turno/venta atómico, incluso precio cero.

Después de 02/03 la función informaba versión 2; con la corrección 04 aplicada, `select public.agenda_booking_version();` debe devolver **3**.

Referencia histórica: cuando se aplican manualmente desde SQL Editor, el historial se registra SOLO tras ejecución correcta. Estas entradas ya fueron verificadas; no repetir su reparación:

```powershell
npx supabase migration repair 20261014120001 20261014120002 20261014120003 --status applied --linked
npx supabase migration list --linked
```

`migration repair` solo registra historial, NO ejecuta SQL.

Implementado en este bloque:

- Lectura compatible de selección opcional, visibilidad online, horarios heredados y margen cero.
- Los errores de permisos no se confunden con migraciones faltantes.
- Resolución de tarifas: null hereda, cero se conserva, valores inválidos se rechazan.
- Disponibilidad pura por profesional: intersección de horarios, pausas, margen, bloques y deduplicación. No inventa una agenda única cuando todos están ocultos.
- Borrador aditivo con claves por organización, RLS y cotizaciones privadas.

La base fue generada por CLI como `20261008225127_agenda_professional_booking.sql` y ordenada después de `20261014120000`. Los dos archivos nuevos se ordenaron detrás de ella; no se modificó DDL aplicado.

La copia en `docs/qa/sql-drafts` es histórica. Los SQL ejecutables están en `supabase/migrations`.

## Pendiente

Aceptación de staging: concurrencia de dos conexiones, Supabase Auth/RLS real, triggers contables auxiliares y navegador autenticado tras aplicar SQL. Probar dos clientes por el mismo horario, ausencia superpuesta, precio oculto, tarifa mayor que catálogo, cero y respuesta perdida: una sola cita/venta, caja y reportes consistentes.

No se ejecutaron migraciones remotas, push, despliegue ni pruebas de producción.

## Evidencia de este bloque

- Se ejecutan migraciones y funciones financieras reales con PGlite; sus fixtures periféricos no equivalen a Supabase completo. Docker no está disponible.
- Las nuevas pruebas se observaron fallar antes de implementar sus reglas.
- `git diff --check` enfocado pasó.
- Verificación local: PostgreSQL 17/17, pruebas servidor 54/54 e interfaz 12/12. TypeScript y ESLint enfocado pasaron. No equivalen a suite completa, build ni prueba de producción.
- La revisión independiente final se completó y detectó dos problemas adicionales: privacidad al cambiar servicio y aceptación no vinculada a términos. Se corrigieron con comprobación conservadora del servicio actual y un wrapper SQL transaccional aditivo.
- No se verificó concurrencia de dos conexiones ni navegador autenticado. Las pruebas antiguas que inspeccionan texto SQL no cuentan como ejecución de PostgreSQL.

```powershell
node --test scripts/agenda-booking-db.test.mjs
npx vitest run --config vitest.agenda.config.ts --pool=threads
npx vitest run --config vitest.agenda-ui.config.ts --pool=threads
npx tsc --noEmit --pretty false --incremental
```

## Corrección adicional antes de publicar

`20261014120004_agenda_accepted_terms.sql` se aplicó después de los SQL anteriores. Las migraciones aplicadas no se editan ni se repiten. La capacidad profesional requiere ahora `agenda_booking_version() >= 3`.

El wrapper compara precio, duración y margen realmente guardados con el snapshot que aceptó el operador. Si cambian, devuelve `ACCEPTED_TERMS_CHANGED` y revierte la cita y eventos en la misma transacción; la RPC base no es ejecutable directamente ni por `service_role`.

Verificación adicional local: 19/19 pruebas PostgreSQL y 56/56 pruebas de servidor. La aplicación remota fue confirmada posteriormente; el despliegue de este bloque sigue pendiente.

El usuario confirmó aplicación de 04; consulta remota de solo lectura verificó versión 3, wrapper solo service-role y base sin ejecución directa. La comprobación remota posterior confirmó también `20261014120004` en el historial de migraciones. No repetir SQL ni reparar nuevamente esa entrada. No se ejecutaron escrituras remotas desde esta tarea.
