# Control financiero: implementación y verificación

Fecha: 2026-11-11. Rama local: `feat/mobile-finanzas-coherencia`, worktree `fin-ux`. Complementa la auditoría móvil anterior y conserva sus cambios sin commit.

## Entrega

La pestaña **Control** está integrada en Finanzas web y móvil. Incluye:

1. **Origen de importes**: detalle paginado de ingresos, costos, gastos, nómina, resultado, cobros, pagos y flujo; referencias al registro y accesos a comprobantes de venta y registros móviles. Las líneas salen del mismo cálculo del resumen, incluyendo devoluciones, reversiones y diferencias de caja. Los casos que siguen siendo agregados se identifican expresamente: no son comprobantes individuales. La respuesta valida que la suma del detalle coincida con el total, cuando existe un total definitivo.
2. **Proyección de 7 y 30 días**: cuotas pendientes por cobrar y gastos registrados con vencimiento. Se separan de los vencidos, se listan compromisos y se declara la cobertura. No inventa saldo inicial ni saldo bancario: muestra variación prevista, no efectivo disponible. No incluye ventas futuras, nómina sin vencimiento ni recurrentes todavía no generados. Un fallo de lectura inhabilita la proyección en vez de mostrar cero.
3. **Conciliación**: diferencias registradas de caja y advertencias del motor financiero. Revisión asistida, sin ajustes automáticos ni confirmación bancaria por ausencia de alertas. No es una integración con extractos bancarios.
4. **Presupuestos**: límites mensuales por categoría, empresa, sucursal y moneda; comparados con obligaciones registradas del mes de la fecha inicial, incluidas las no pagadas. Esto no es caja ni una acumulación de meses. Se pueden configurar hasta 100 límites; la lista de selección muestra hasta 100 categorías activas.
5. **Alertas configurables**: vencimientos, incidencias de conciliación y límites alcanzados; anticipación entre 1 y 30 días. Se muestran dentro de Finanzas al consultar datos; no hay push, correos ni mensajes automáticos nuevos.
6. **Cierre mensual informativo**: solo mes completo terminado y con cobertura completa. Se guarda el resultado calculado por el servidor, autor, fecha, motivo y huella del origen de importes. Las revisiones agregan versiones; no borran anteriores. Se comparan totales, cobertura y huella al volver al mismo mes completo. No bloquea operaciones, conforme a la respuesta del usuario. La huella describe las líneas del motor financiero; no es una bitácora de cada campo de todas las tablas operativas.

Se corrigió además el calendario web: usa la zona del negocio para fechas iniciales y accesos rápidos, como móvil. Se conservan rangos elegidos manualmente. Una consulta fallida del calendario bloquea la carga en vez de asumir una zona equivocada.

## Persistencia y seguridad

Migración NUEVA, PREPARADA Y NO APLICADA: `supabase/migrations/20261111193000_finance_control_history.sql`.

Crea eventos inmutables de configuración/cierre con RLS, sin acceso directo de `anon`/`authenticated`. El rol de servicio solo puede leer la tabla y ejecutar el RPC de inserción controlada; no tiene UPDATE/DELETE ni INSERT directo. El RPC serializa por empresa/sucursal/moneda, valida la pertenencia de la sucursal, conserva idempotencia y evita pisar una configuración modificada por otro administrador mediante versión esperada. Se conserva el actor proveniente de autenticación del servidor. Las rutas usan `withAdminAuth`, resolución de empresa/módulo y validación de sucursal antes de leer/escribir.

El cliente no puede entregar un snapshot financiero ni elegir el autor. Se verifica moneda vigente y se rechazan categorías ajenas/inactivas. Se rechazan empresas contradictorias entre encabezado y query. Respuestas privadas sin caché compartida. Ante guardado incierto se conserva contenido y clave, se bloquea la edición y se ofrece recuperar el mismo guardado durante la pantalla actual. No se promete recuperación de estas preferencias después de cerrar la app; son distintas de los pagos de gastos, que conservan su mecanismo persistente anterior.

Mientras falte la migración, las lecturas existentes siguen funcionando y las opciones de guardar presupuesto, preferencias y cierre quedan deshabilitadas con mensaje explícito. No se usa almacenamiento local como falsa persistencia de empresa.

## Verificación

Pruebas del modelo, calendario cerca de medianoche, sumas del detalle, cambios de origen con total igual, aislamiento empresa/sucursal, rechazo de snapshots de cliente, período de cierre, moneda, categorías, falta de migración, UI y reintentos. También se ejecuta toda la suite financiera existente, con mocks/fixtures.

Prueba funcional en navegador: fixture aislado en 127.0.0.1:3107, sin APIs reales. Se comprobaron proyección, lista de vencimientos, edición/guardado simulado de presupuesto y bloqueo sin migración. La vista se detuvo al terminar, sin tocar el puerto 3000. Usó CSS auxiliar: faltan `tailwindcss` y `@tailwindcss/postcss` en las dependencias instaladas de este entorno; por eso no acredita la apariencia de una compilación Next de producción.

Pendiente: ejecutar la migración en un Postgres local antes de aplicarla a un entorno autorizado (Docker no está iniciado), validación visual con las dependencias completas y prueba física en Expo/iPhone/Android. No se verificó ni modificó producción, no se aplicó SQL, no se hizo commit, push, merge ni deploy.

Resultados finales observados: 47 archivos de pruebas financieras, 386 pruebas aprobadas, exit 0. TypeScript raíz y mobile: exit 0. ESLint de archivos modificados raíz y mobile: exit 0, sin errores ni advertencias. git diff --check: exit 0. No se ejecutó la suite completa de todo el repositorio ni una compilación Next de producción.
