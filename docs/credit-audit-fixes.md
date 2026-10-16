# Correcciones de la auditoría de créditos

## Alcance

- El cobro rápido abre el diálogo completo, conservando importe y método. Tarjetas y transferencias requieren comprobante antes de cobrar.
- El portal determina la mora por día y zona horaria de la organización, igual que el dashboard.
- El plazo y último vencimiento salen de las cuotas existentes; una cuota semanal no se presenta como un mes.
- Los reportes distinguen capital e interés mediante los componentes de cada cuota. Cuando un registro histórico no tiene un desglose válido, se conserva la interpretación anterior sin inventar componentes.
- Los comprobantes reciben lo pagado desde los cobros registrados. No se infieren cobros restando el saldo a una cabecera discrepante.
- La cartera y el detalle advierten si hay diferencias entre cabecera y plan. `scripts/sql/credit-reconciliation.sql` permite listar las diferencias sin modificar datos. Deben conciliarse con el contrato; no hay saneamiento automático.
- Los recordatorios consultan cuotas pendientes de créditos activos/morosos, descuentan pagos parciales y excluyen cuotas que vencen hoy o en el futuro.

## Migración

`supabase/migrations/20261015215221_credit_audit_hardening.sql`:

1. Retira a `PUBLIC`, `anon` y `authenticated` el acceso a `register_credit_payment_atomic`. Las pantallas actuales usan la operación atómica del servidor.
2. Conserva en `customer_collection_requests.result.receipt` los datos usados para imprimir cada nuevo cobro. El mismo resultado persistido se utiliza al imprimir por primera vez, reimprimir y recuperar un intento incierto.
3. Incluye capital financiado y pagos reales en los saldos devueltos. Conserva las claves de idempotencia, autorización y bloqueos del cobro existente.

La migración no reescribe saldos, contratos ni comprobantes anteriores. Su fecha es anterior a una migración ya registrada (`20261017100000`); revisar la lista de migraciones pendientes antes de usar un push automático, o aplicar exclusivamente el archivo y luego conciliar su historial tras verificar los objetos.

El usuario aplicó esta migración en producción. Se verificó que las dos funciones coinciden con el archivo local y que `anon` y `authenticated` no pueden ejecutar el cobro antiguo ni las funciones internas del nuevo recibo. Se registró la versión `20261015215221` como aplicada mediante `migration repair`, sin repetir el SQL ni modificar operaciones financieras. Otros entornos deben aplicar la migración antes de usar estas correcciones.

## Comprobantes históricos

`GET /api/credits/receipts?paymentId=...` verifica primero que el pago pertenezca a la organización activa. Devuelve el cobro completo, no una asignación aislada, con caché privada deshabilitada.

- Con captura persistida: usa el número, fecha, reparto, identificación, moneda e importes originales.
- Con resultado antiguo sin captura: conserva el número y reparto guardados y aclara que no existe un estado completo original de la cuenta; no imprime totales actuales como históricos.
- Sin comprobante vinculado: genera una constancia marcada `HIST-`, identifica la limitación y no afirma conocer el saldo original.

Las correcciones administrativas posteriores permanecen en su historial; no reescriben el documento original. Consultar el estado de cuenta para ver el saldo vigente.

## Validación de SQL sin tocar Supabase

Instalar `@electric-sql/pglite` en una carpeta temporal y ejecutar desde el repositorio:

```powershell
node scripts/test-credit-audit-sql.cjs C:\ruta\temporal\package.json
```

El script crea PostgreSQL en memoria, carga el trigger real de pagos, aplica las dos migraciones de cobro y prueba permisos, reparto, saldos y recuperación idempotente del recibo. Las tablas mínimas y los auxiliares de autorización son fixtures: este ensayo no sustituye la comprobación de permisos y objetos después de aplicar la migración en el entorno destino.

Referencia de permisos: https://supabase.com/docs/guides/database/postgres/roles
