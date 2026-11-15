# Finanzas móvil coherentes y auditoría integral

Alcance aprobado: implementar recomendaciones y auditar la sección completa sin publicar ni operar contra datos reales. Mantener los cambios de registro y /admin anteriores.

1. Integridad compartida: no ocultar deudas, distinguir indisponibilidad, validar importes y ecuaciones; pruebas de fallos primero.
2. Resumen: períodos equivalentes a web, rango personalizado, fecha/sucursal del informe real, ocultar datos de otro alcance, conectar con Créditos y listas completas.
3. Gestión nativa: Gastos y Por pagar con filtros/paginación; registrar gastos y pagos parciales con las APIs existentes, caja abierta e idempotencia persistida antes del envío. Ante resultado incierto recuperar la misma operación.
4. Equipo y rentabilidad: consultas nativas del período y sucursal, detalle por colaborador y agrupación, sin confundir borradores con pagos. Exportación compartible usando los números verificados.
5. Web/API: estados vacíos y deudas coherentes; auditar cálculo de ventas, devoluciones, costos, cobros, egresos, nómina, tenant y permisos. No hacer fallbacks de escritura financiera directa.
6. Verificación: pruebas financieras completas y de aislamiento, TypeScript y ESLint raíz/mobile; auditoría final documentada con alcance y límites de prueba física. Sin migraciones, commit, push, merge ni deploy en esta tarea.