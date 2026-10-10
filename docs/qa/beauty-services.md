# Belleza, servicios y perfiles del equipo

## Estado local

Rama `codex/beauty-services`. No se aplicaron migraciones remotas ni se publicó esta funcionalidad. Verificación global y prueba autenticada pendientes; no considerar este documento una aprobación de producción.

## SQL nuevo (orden obligatorio)

1. `supabase/migrations/20261014120005_beauty_services_profile.sql`: nuevo rubro, especialidades y modalidades, preservando identificadores existentes.
2. `supabase/migrations/20261014120006_apply_service_website_proposal.sql`: vista previa versionada y confirmación transaccional con auditoría, ejecución solo desde servidor.
3. `supabase/migrations/20261014120007_agenda_service_creation_atomic.sql`: alta atómica de producto y servicio, auditoría y reintento idempotente. Es la nueva migración pendiente de esta entrega; el usuario declaró aplicadas 05 y 06.

Son posteriores a `20261014120004_agenda_accepted_terms.sql`. No ejecutar las versiones antiguas con fecha 20261009: fueron renombradas antes de aplicarse para respetar el orden del repositorio. Aplicar primero en un entorno de prueba; luego verificar `supabase migration list --linked`. No usar `migration repair --status applied` para ejecutar SQL: solo registra historial.

## Cómo verificar el flujo

- Guardar el perfil con varias especialidades (por ejemplo uñas y pestañas). Omitir campos en un PATCH debe conservarlos; una selección vacía explícita debe vaciarlos.
- En `/dashboard/agenda/configuracion#servicios`, comprobar sugerencias por especialidad, exclusión de nombres existentes sin distinguir acentos/mayúsculas y alta personalizada. Completar precio y duración reales; seleccionar una sugerencia no crea productos.
- El alta usa un único POST `/api/agenda/services`, sin reenviar horarios. Probar precio cero, 55 minutos, catálogo y online independientes, cierre/reapertura y reintento después de respuesta perdida. El mismo intento devuelve el mismo producto. El lote conserva marcadores de completados y pendientes; cambiar de sección no desmonta los borradores.
- En «Quién atiende», editar foto y especialidad, verificar presentación pública y configurar servicios, disponibilidad y tarifas con las funciones actualmente habilitadas. El perfil no crea usuarios ni permisos de acceso.
- Abrir «Preparar mi página de servicios», editar y generar vista previa. La portada prioriza el menú de la agenda pública si está habilitada. Sin agenda pública usa los servicios del sitio.
- Cancelar no publica. Editar opciones invalida la propuesta anterior. Confirmar es un paso separado; editar el sitio en otra sesión debe invalidar la revisión. Fallo de auditoría debe revertir todo.
- Verificar que checkout, reservas, precios, duraciones y tarifas existentes no cambian al elegir una variante visual.

## Evidencia y pendientes

Pruebas focalizadas de lógica/SQL/rutas: 25/25. Pruebas de interfaz aisladas: 5/5; la prueba del diálogo completo se volvió a ejecutar después de corregir el transporte de agenda (1/1). Compatibilidad con setup compartido: 9/9. ESLint focalizado sin errores. La revisión independiente detectó y guió correcciones de valores orientativos y discrepancia de vista previa.

Pendientes: TypeScript global, suite completa y build; migraciones reales, dos conexiones PostgreSQL concurrentes, prueba autenticada y responsive 320/768/1024/1440. PGlite prueba restricciones/rollback/revisión secuencial, no concurrencia en el servidor remoto.

## Alta atómica — verificación 2026-10-09

SQL 4/4 y endpoint 7/7 pasaron localmente. Permisos comprobados con guard real y actor SQL; rollback por auditoría, replay al último cupo y política obsoleta cubiertos. La revisión independiente detectó y se corrigieron pérdida de borradores, carrera de módulos e inversión de locks con POS: la RPC usa NOWAIT y try-advisory, devuelve 409 temporal en vez de esperar circularmente. El lock de productos es global y puede rechazar temporalmente operaciones de distintos tenants. Escritores anteriores que verifican cupo fuera de la transacción no adquieren automáticamente estas garantías.

La primera ejecución UI falló al iniciar workers con ~550 MB de RAM libres. Tras limitar memoria y liberar recursos, las pruebas de UI pasaron 6/6 con aislamiento por archivo (forks). Cubren precio cero, minutos personalizados, reintento/doble envío, formato PYG, cierre/reapertura, rechazo posterior a respuesta perdida y lote parcialmente completado. `npm run typecheck` pasó después de corregir el tipo del rol. ESLint focalizado y `git diff --check` pasaron. Navegador local: timeout al abrir agenda; sin prueba autenticada ni responsive. No se ejecutó SQL remoto ni se publicó. No interpretar estas comprobaciones focalizadas como suite global verde.
