# PDF móvil de pagos e integración local — 12/11/2026

Se implementó compartir PDF desde el cobro confirmado y desde el historial del cliente, usando el snapshot persistido. No reconstruye un comprobante histórico con datos actuales ni envía otro cobro al compartir. El usuario elige destino mediante el diálogo del sistema.

## Controles
- Datos originales, fecha/zona horaria y moneda obligatorias; error explícito si no están disponibles.
- Escapado HTML y política de contenido sin recursos externos.
- Verificación del contexto privado antes y después de generar el archivo; eliminación del temporal al terminar.
- Transferencia/tarjeta no afirman acreditación bancaria; comprobante no sustituye factura fiscal.
- No requiere dependencia nueva ni migración.

## Integración
- Fuente: worktree fin-ux, base 420e6fff.
- Destino activo: C:/proyecto/mitiendapy, rama sync/claude-2026-11-11.
- 70 archivos revisados, 60 escritos; 10 ya coincidían.
- 51 archivos ajenos preservados y comprobados por SHA256.
- Se conservaron las mejoras de lectura de caja de la copia activa y la corrección de summary-integrity que evalúa únicamente los tres totales de caja.
- Respaldo previo y manifiesto: C:/Users/EDU/AppData/Local/Temp/mitiendapy-fin-sync-20261112-GSd8lp.
- No commit, push, merge de ramas, deploy ni aplicación de migraciones.

## Verificación
- TypeScript raíz y móvil y ESLint de archivos integrados aprobados.
- Batería amplia: 764 pruebas aprobadas, 8 omitidas y 1 regresión de interfaz detectada (selector de sucursal única).
- Regresión corregida en código, conservando el test: reejecución de 3 archivos / 19 pruebas aprobadas (incluye los 9 tests nuevos de PDF). No se presenta el primer run como exitoso.
- Metro iOS devuelve HTTP 200 y el bundle incluye PDF, barra de Finanzas y resumen de cuotas.
- Prueba física iPhone/Android pendiente. No se realizaron cobros ni consultas manuales a datos de producción.
- Conciliación persistente y anulación auditada siguen pendientes; no forman parte del PDF. La migración anterior de finance-control se copió como archivo pero no se aplicó.
