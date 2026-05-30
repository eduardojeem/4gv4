# Auditoria de /superadmin/subscriptions

## Estado anterior

- La seccion usaba datos estaticos con `SuperAdminSectionPage`.
- No leia la tabla real `subscriptions`.
- El texto mencionaba `current_period_end`, pero el esquema SaaS define `current_period_ends_at`.
- No habia filtros operativos, exportacion ni vista responsive especifica para renovaciones.

## Cambios aplicados

- La pagina server carga suscripciones reales, organizaciones y owners.
- Se agrego un dashboard dedicado con metricas de activas, trials, riesgo, renovaciones y MRR estimado.
- Se agregaron filtros por busqueda, plan, estado, proveedor y periodo.
- Se agrego exportacion CSV, refresh y accesos hacia facturacion, organizacion y tienda publica.
- La tabla desktop se complementa con tarjetas mobile para mantener una lectura comoda en pantallas chicas.
- Se agregaron segmentos operativos: todas, atencion, renovaciones, trials y cancelaciones.
- Se agrego cola de atencion, ordenamiento por prioridad/renovacion/trial/plan/nombre y modal de detalle.
- Se agrego copia rapida de IDs internos y externos para soporte/billing.
- Se agrego detalle del plan con limites y modulos cargados desde `plans`.
- Se agrego edicion de plan, estado, fechas de periodo/trial y cancelacion al cierre.
- Los cambios se guardan por API superadmin y sincronizan `subscriptions.plan` con `organizations.plan` en Supabase.

## Pendientes sugeridos

- Sincronizar precios reales por plan desde una tabla de planes o billing provider en lugar del estimado local.
- Revisar `/superadmin/billing`, porque aun referencia `current_period_end` y deberia usar `current_period_ends_at`.
