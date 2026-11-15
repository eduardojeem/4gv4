# Planes: coherencia y revisión de base — 12/11/2026

## Consulta real de solo lectura
Proyecto Supabase de MiTiendaPy: cswtugmwazxdktntndpy. Solo se ejecutaron SELECT de catálogo, estructura, funciones, triggers y agregados. No se modificaron planes, clientes, fechas o pagos.

| Nombre comercial | Código interno | Slug público | Precio mensual Gs. | Comercial/técnico activos | Organizaciones | Reparaciones/mes |
|---|---|---|---:|---|---:|---|
| BASIC | FREE | basic | 50.000 | Sí / Sí | 6 | 150 |
| Pro | BASIC | pro | 120.000 | Sí / Sí | 5 | 300 |
| Pro Max | PRO | pro-plus | 200.000 | Sí / Sí | 8 | Sin límite |
| ULTRA | ENTERPRISE | ultra | 300.000 | No / No | 1 | Sin límite |

Los cuatro registros comerciales fueron creados el 28/05/2026 (UTC). El nombre visible y el slug se cambiaron conservando la identidad interna. No hay un plan con precio cero.

- BASIC: 1 usuario, 1 sucursal, 2 cajas, 200 productos y 1 foto/reparación.
- Pro: 5 usuarios, 2 sucursales, 3 cajas, 500 productos y 3 fotos/reparación.
- Pro Max: 15 usuarios, 5 sucursales, 10 cajas, 10.000 productos y 6 fotos/reparación.
- ULTRA: usuarios/sucursales/productos sin límite, 1 caja y 0 fotos/reparación. Está retirado, pero conserva una organización activa; no se reasignó.
- Límites comerciales y técnicos coinciden en los recursos publicados. Categorías técnicas sin límite; servicios no tienen un cupo explícito en estas filas, no se inventó uno.
- Los triggers normalize_popular_subscription_plan y sync_subscription_plans_to_plans están habilitados (O).
- subscription_plans contiene venta y presentación; plans contiene límites y módulos operativos; el trigger sincroniza nombre/límites/módulos/estado. subscriptions.plan y organizations.plan conservan los códigos internos.
- Plantillas configuradas: FREE/BASIC comercial tiene 8; BASIC/Pro, PRO/Pro Max y ENTERPRISE/ULTRA tienen 14. Pro y Pro Max tienen actualmente el mismo acceso a plantillas; se diferencian por módulos y cupos. No se alteró esta configuración.

## Política confirmada por el usuario
Al terminar el período sin renovar se suspenden las operaciones, se conserva plan/historial y sigue disponible consultar/renovar la cuenta. No se convierte automáticamente un plan pago en gratuito.

Impacto de la consulta: 8 suscripciones cumplen la condición de bloqueo (FREE:6, BASIC:1, PRO:1). Hay 4 suscripciones activas sin fin de período definido (FREE:3, PRO:1); requieren revisar la asignación manual, no se les inventó una fecha. Ese conteo de cuatro incluye cuentas que además pueden estar impagas.

## Cambios locales
- Clasificación compartida por precio verificado, no por código FREE.
- Resolución del catálogo: no usa límites Free ni importe cero si falta la configuración; admite consultar el plan retirado de un cliente, sin ofrecerlo para nuevas contrataciones.
- Fallback identificado como no verificado; no habilita activaciones ni operaciones.
- Avisos de vencimiento para BASIC pago; recordatorios consultan precio real.
- Cancelación conserva el período pagado y suspende al finalizar; no exige reducir recursos ni modifica el código de plan.
- Guards de mutaciones de tenant/admin y contexto de reparaciones. Lectura y rutas de suscripción/renovación siguen disponibles; permisos existentes se conservan.
- Mensajes web/móvil explican suspensión y renovación; Super Admin distingue código histórico y nombre comercial.

## Base real: pendiente, sin aplicar
Migración creada con CLI oficial: supabase/migrations/20261112215428_subscription_paid_plan_consistency.sql.
Reemplaza las tres funciones usadas por cron (expire_paid_periods, expire_trials y downgrade_overdue_accounts), conserva sus nombres, suspende sin cambiar plan y verifica precio cero en apply_free_subscription_plan. No ejecuta actualizaciones de clientes durante la creación de las funciones.
La base real todavía tiene el proceso anterior que cambia cuentas a FREE y las reactiva después del impago. Se necesita desplegar el código y aplicar esta migración para completar el cambio remoto; no se hizo push/deploy/migración en producción.

## Verificación
Pruebas de la migración en PostgreSQL local en memoria (PGlite): 6 aprobadas, incluyendo FREE pago, plan retirado, vencimientos futuros y privilegios. TypeScript raíz/móvil y ESLint aprobados. Expo iOS compiló el helper compartido con HTTP 200. Batería final: 74 archivos, 497 pruebas aprobadas y 1 timeout (498 en total). El archivo del timeout se reejecutó aislado: sus 6 pruebas aprobaron. No se aumentó el timeout ni se presenta el primer run como exitoso. No se realizaron pagos ni envíos de notificaciones reales.
