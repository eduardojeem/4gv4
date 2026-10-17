# Correcciones de la auditoría del dashboard

Auditoría del 16 de octubre de 2026, base `9240bec3`. Implementación local; la aplicación de SQL y la publicación se coordinan por separado.

## Cobertura

| Hallazgo | Corrección |
| --- | --- |
| Posventa con efectos parciales y reintentos duplicados | Creación y resolución mediante funciones atómicas exclusivas del servidor; bloqueo del caso y origen, validaciones previas y resultado persistido por transición. Stock, dinero, puntos, retrabajo y estado comparten transacción. |
| Reintegro guardado eludía el tope | Un solo importe efectivo, con unidades proporcionales en aritmética decimal, descuento/impuesto de la factura y límite acumulado. Reparaciones descuentan reintegros anteriores. El formulario envía cero explícito. |
| Escrituras directas de caja | Revocación de todos los privilegios de escritura, incluido TRUNCATE, para clientes anónimos/autenticados; se mantienen lecturas protegidas y operaciones de servidor. |
| Lectura financiera solapada | Eliminación de la política permisiva amplia y guardia restrictiva para movimientos de finanzas/nómina. Se conserva el alcance por sucursal. |
| Saldo de Inicio inconsistente | Calculador compartido de efectivo físico y normalización de movimientos; moneda regional, fecha de actualización y error recuperable. |
| Comparaciones y ventas mensuales ficticias | Eliminadas variaciones/predicciones inventadas; series reales completas o estado no disponible. Clientes activos deja de llamarse retención. |
| Deuda cero reemplazada por saldo antiguo | Un resumen confirmado en cero prevalece sobre el campo histórico. |
| Métricas de taller discordantes | Ingresos de trabajos entregados, costo final cero respetado, período compartido por resumen/gráficos/técnicos/PDF y compromiso real para puntualidad. El período agrupa por fecha de ingreso, explícito en pantalla. |
| Prioridades omitían trabajos antiguos | Filtrado activo en servidor y lectura paginada completa; factores sin información no se presentan como medidos. |
| Catálogo operativo de demostración | Fuentes reales de categorías/marcas/proveedores; cobertura comprobada y exportación habilitada únicamente con un snapshot completo del negocio actual. Edición en las secciones mantenidas. |
| Borradores compartidos | Clave de presupuesto por usuario y organización; controles contra guardar datos de otro contexto. |
| Error confundido con vacío o módulo ausente | Inicio, Agenda y Vencimientos distinguen fallos de red/HTTP/respuesta inválida y permiten reintentar. |
| Gerencia bloqueada por rol heredado | Navegación, proxy, guardia y página usan permisos de la membresía activa para analíticas y asignación de técnicos. |
| Datos anteriores tras cambiar negocio | Reinicio, cancelación y descarte por alcance en promociones, presupuestos, pedidos y reparaciones. |
| Límites silenciosos | Paginación completa en promociones, presupuestos, reparaciones, categorías, ventas mensuales, Inicio y POS. Fallar una página invalida el resultado, no publica un total parcial. |
| Mejoras adicionales | POS filtrado por sucursal; Inicio usa zona horaria del negocio; proveedores usan moneda configurada; preferencias visuales del técnico persistidas por usuario/negocio con alcance explícito; ruta products-modern redirigida; autores de Posts reales o no disponibles. |

Stock de Posventa: se actualiza el inventario de la sucursal, cuyos triggers mantienen el agregado global. Una devolución de variante restaura la variante vendida. El contrato actual no permite elegir variante de reemplazo: esos reemplazos se rechazan claramente y se revierte la operación completa. No se descuenta una variante arbitraria. Se impide anular una venta que ya tenga Posventa completada, y viceversa, para evitar una segunda devolución.

## Migración y entrega

Nueva migración: `supabase/migrations/20261016214756_dashboard_financial_atomic_hardening.sql`. No recalcula contratos, pagos ni importes históricos.

Aplicación y despliegue deben coordinarse en una ventana de Posventa: las APIs nuevas necesitan las funciones SQL nuevas; la migración revoca las escrituras directas que usaban las APIs anteriores. Sin migración, las nuevas operaciones devuelven 503 y no recurren a escrituras parciales. No reabrir privilegios de caja como solución de rollback; mantener Posventa fuera de servicio hasta restaurar una versión compatible.

Los cuatro contratos históricos observados en la auditoría siguen pendientes de conciliación contra sus acuerdos originales. No se modificaron automáticamente. Casos antiguos sin una línea de venta válida requieren revisión del origen antes de una devolución; no se adivinan asociaciones.

## Verificación reproducible

```powershell
node scripts/test-dashboard-financial-sql.cjs
node scripts/test-after-sales-stock-sql.cjs
node node_modules/typescript/bin/tsc --noEmit --skipLibCheck
```

Los scripts SQL usan PostgreSQL local en PGlite, el helper real de actor y los cuerpos de funciones/triggers de inventario del baseline. Cubren importes guardados, descuentos, cantidades parciales, topes acumulados, autorización, reversión de efectos ante fallo final, reintentos, retrabajo, stock por sucursal/variante y privilegios/RLS. El resto del esquema y algunos servicios son fixtures: no equivalen a una prueba autenticada contra la base remota ni a una prueba de concurrencia con múltiples conexiones.

Regresiones de interfaz/hooks/API: errores y reintento, respuesta de otra organización, más de 1.000 filas, segunda página fallida, costo/deuda cero, permisos, exportación y reintegro cero. TypeScript, ESLint enfocado y compilación Next.js con webpack forman los controles de integración. No se usó la suite global como evidencia de este trabajo.

Pendiente de verificación de entrega: sesión autenticada con dos organizaciones y distintos permisos; aplicación remota de la migración; CI, publicación y comprobación en producción. La implementación no ejecuta operaciones financieras reales.

Fuentes para la semántica de seguridad: [RLS en Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) y [bloqueos de filas de PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html).

Resultado local: **257 pruebas en 31 archivos**, TypeScript y ESLint enfocado pasan. Ambos scripts PostgreSQL locales pasan. La primera compilación Next.js 16.3.8 con webpack terminó correctamente y generó 283 páginas estáticas; una repetición adicional se interrumpió para liberar recursos tras timeouts de workers. La corrida final de pruebas se ejecutó sin compilar en paralelo y pasó completa. No se realizó una validación autenticada en navegador.
