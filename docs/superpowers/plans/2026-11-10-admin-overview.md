# Mejoras del resumen /admin

Autorización vigente del usuario: «implementar mejoras recomendadas», posterior a la auditoría de /admin. Sustituye el alcance anterior de solo lectura para estas mejoras. No modificar los archivos pendientes de Claude.

Diseño aprobado: separar Necesita atención, Actividad de hoy y Accesos; mostrar No disponible ante errores; respetar módulos y permisos; explicar alcance de sucursal y organización.

1. Reproducir fallos con tests de consultas fallidas, sucursales, paginación y cambios de organización.
2. Corregir src/hooks/use-admin-overview-metrics.ts: consultas explícitas por organización, paginación, stock por sucursal, indicadores nulos ante errores y respuestas fuera de orden.
3. Corregir carga inicial de reparaciones en src/contexts/RepairsContext.tsx para /admin, condicionada al módulo habilitado.
4. Mejorar src/app/admin/page.tsx y verificar permisos con la configuración de navegación existente.
5. Ejecutar tests con datos simulados, ESLint y TypeScript. No consultar producción. No commit, push, merge ni deploy.