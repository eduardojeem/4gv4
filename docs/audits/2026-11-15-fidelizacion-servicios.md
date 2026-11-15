# Fidelización para barberías y servicios — 2026-11-15

Implementación local en C:\proyecto\mitiendapy. No se escribió en producción ni se aplicó la migración; sin commit, push o deploy.

## Comportamiento

- /dashboard/promotions?tab=puntos se presenta como Fidelización y beneficios, con Programa, Clientes y resultados, y Sorteos opcionales.
- Modos: monto pagado, turnos atendidos y pagados por completo, o ambos. El modo predeterminado conserva el programa monetario y sus saldos.
- Cada turno vinculado a una venta válida registra una visita única. No se infiere de los movimientos de puntos, de un importe enviado por el navegador ni de la creación de una reserva. Se valida organización, cliente, estado del turno y pago de la venta.
- Los turnos financiados se registran una sola vez al saldar todos los créditos vinculados. Las cuotas monetarias conservan sus propias claves de idempotencia y ahora se vinculan a la venta.
- Registro prospectivo desde service_visits_started_at; no se inventan visitas anteriores a partir del historial financiero.
- Las devoluciones acumulan su importe una sola vez por clave. Un reintegro total retira la visita del progreso aunque los puntos ya se hayan gastado. El descuento de puntos conserva la política existente de no dejar saldo negativo.
- Los hitos por turnos no se pueden reutilizar mediante reintegros. El modo monetario conserva las reglas anteriores, etiquetadas como acreditaciones porque pueden incluir cuotas. El cupo de campaña consume únicamente el bonus efectivamente acreditado luego del tope diario.
- Progreso: saldo real, turnos válidos, último turno registrado, puntos restantes para el mínimo de canje y valor monetario. Los puntos y las visitas son magnitudes distintas. Métricas globales y búsqueda por nombre con páginas de 25 clientes.
- Consultas por organización validada y RPC con permiso promotions.read. Tablas nuevas sin acceso directo para anon/authenticated. Solicitudes web incluyen la organización activa; al cambiar de organización se reinicia el panel.
- Errores de permisos, red o migración no se presentan como listas o saldos vacíos. Los borradores se conservan al cambiar de pestaña y al fallar un guardado.

## Migración pendiente

supabase/migrations/20261115161607_loyalty_service_program.sql

Creada con Supabase CLI, probada con PostgreSQL embebido (PGlite), NO aplicada remotamente. Sin ella, el programa anterior por monto sigue disponible; el modo por turnos queda deshabilitado y la consulta nueva explica la dependencia.

El canje implementado es por saldo a favor, utilizable para pagar compras o servicios mediante el flujo existente. No es una recompensa restringida a un servicio concreto. Los cupones de servicio gratis y campañas automáticas de reactivación/cumpleaños requieren otra implementación; no se anuncian como disponibles.

## Verificación

- 185 pruebas del módulo pasaron: SQL de visitas, cuotas, reintegros, hitos y topes; API; errores y organización del hook; POS, canjes y compatibilidad anterior. Última corrección de vocabulario de campañas: 5 regresiones adicionales pasaron (subconjunto).
- TypeScript raíz y mobile sin errores; ESLint de los archivos tocados sin errores. Los avisos de vi.mock anidado en src/test/setup.ts son previos.
- Chrome real con componentes y red interceptada, datos ficticios: 375 y 1280 px, sin desbordes ni errores de página. Reintento, guardado del payload y conservación del borrador comprobados. No se guardó configuración de ninguna empresa real.
- No se verificó la UI nueva en el servidor de Claude del puerto 3000 ni en producción. No se modificó esa worktree.