# Ampliación de Finanzas — 2026-11-11

Alcance aprobado: seis recomendaciones en web/móvil; preservar la implementación local anterior. Cierre aprobado: versiones con historial, sin bloquear operaciones. No producción, push ni deploy. Migración nueva solo preparada.

Diseño: una vista «Control» consulta datos actuales desde el mismo motor financiero; detalle por métrica reutiliza sus líneas para evitar otro cálculo. Proyección de compromisos a 7/30 días sin inventar saldo bancario. Conciliación muestra discrepancias de caja y avisos de cobros pendientes de revisar, sin corregir importes automáticamente. Presupuestos mensuales y preferencias de alertas se guardan por empresa/sucursal/moneda. Cierre mensual informativo inmutable, con autor, fecha, motivo y comparación con el informe actual; cada revisión es nueva.

1. Modelo puro y tests: proyección, presupuestos, alertas, comparación de cierres y validación de período/moneda.
2. Motor/API: trazabilidad de las mismas líneas, endpoint protegido por organización/sucursal, lecturas acotadas y fallos visibles.
3. Persistencia: migración RLS/service-only, eventos append-only y RPC de escritura idempotente/versionada; no aplicarla.
4. Consumidores: «Control» web y nativo con detalle paginado, proyección, revisión, formulario de límites/alertas, cierres e historial.
5. Calendario: alinear hoy predeterminado web con zona del negocio conservando rangos explícitos.
6. Verificar: tests financieros y nuevos contratos/aislamiento, TypeScript raíz/mobile, lint de tocados, diff check. Documentar lo no probado en dispositivo/Postgres.
