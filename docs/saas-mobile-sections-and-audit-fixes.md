# SaaS móvil: secciones y correcciones de auditoría

## Navegación

La aplicación Expo tiene cuatro rutas públicas bajo un layout compartido:

| Ruta | Contenido |
| --- | --- |
| `/saas` | Inicio, presentación y preguntas frecuentes |
| `/saas/soluciones` | Herramientas de la plataforma |
| `/saas/negocios` | Casos de uso por tipo de negocio |
| `/saas/planes` | Catálogo operativo, capacidades y registro por plan |

El encabezado, menú de cuenta y barra inferior viven en el layout. La ruta determina la única pestaña seleccionada. Cada pantalla tiene su propio desplazamiento. El menú de cuenta tiene altura máxima y desplazamiento para texto grande. Las preguntas frecuentes comunican el estado expandido y las pestañas su selección.

El cliente carga una vez por entrada al layout `GET /api/mobile/saas`; no consulta tablas de planes directamente. Se reutiliza la caché etiquetada de 300 segundos de la web. Un catálogo vacío es diferente de un fallo HTTP 503. No hay precios, pruebas, descuentos anuales o capacidades inventados como respaldo. Los límites y funciones derivan del catálogo operativo y de la presentación compartida con la web.

La elección del plan abre el registro web con su identificador público. El contacto usa el enlace configurado; ya no existe un teléfono comercial fijo. Si falla una actualización, los datos anteriores se identifican como tales y no permiten contratar hasta volver a consultar. La sesión web y la sesión móvil son independientes.

## Correcciones de lógica

- Errores al consultar el estado del usuario impiden autenticar, incluso ante columnas ausentes; no se sustituye por una consulta que asuma que está activo.
- El resumen de caja pagina el turno completo y verifica cobertura antes de calcular. El historial visible sigue acotado a 30 movimientos.
- El cierre de sesión usa alcance local. Un 401 de una petición de una sesión anterior no cierra la sesión nueva.
- Se retiró el acceso rápido mediante contraseña guardada para biometría. Se eliminan las claves heredadas al iniciar/cerrar sesión. La persistencia normal de Supabase continúa usando almacenamiento cifrado en Android/iOS.
- La versión web de Expo utiliza un adaptador separado con `sessionStorage` por pestaña. El render del servidor no utiliza SecureStore ni comparte credenciales entre peticiones.
- Los filtros repetidos no dejan indicadores de carga bloqueados. La paginación descarta respuestas de filtros anteriores y muestra errores recuperables.
- Ofertas se filtra en el servidor antes de paginar. El barrido existente tiene un límite y la aplicación avisa si los resultados son parciales; no se presenta un total parcial como completo.
- El panel consume capacidades de escritura emitidas por el servidor. Las acciones de crear/editar/eliminar respetan esas capacidades; las APIs mantienen la validación autoritativa.
- Fallos de carga se diferencian de restricciones de acceso. Los resúmenes conservados tras un fallo de actualización muestran el error y la última consulta satisfactoria.
- Las secciones que abren herramientas en el sitio se identifican como Web.

## Consideraciones para publicar

No se necesitan nuevas migraciones para estos cambios. No se ejecutó SQL ni se modificó producción.

El login móvil usa la clave de servicio para el intercambio de credenciales y sustituye el captcha por límites de intentos. En producción ahora exige el limitador compartido existente: si Redis no está configurado o falla, devuelve 503 temporal en vez de usar contadores por proceso. Comprobar la configuración del limitador antes de publicar el backend y la app.

Publicar primero el backend compatible con `/api/mobile/saas` y las capacidades del panel, y después distribuir la app actualizada. El cliente nuevo no debe apuntar a un backend anterior que carezca de estos contratos.

Las pruebas automáticas cubren catálogo, estado de usuario, límites de login, cobertura de caja, respuestas de sesión antiguas, filtrado de ofertas y navegación. La validación en dispositivos físicos y con distintos roles requiere una sesión de prueba y equipos Android/iOS. No se generó ni distribuyó un binario móvil en esta tarea.

## Verificación local

- 13 archivos de pruebas y 52 casos aprobados, ejecutados con un solo worker de Vitest.
- TypeScript web y móvil sin errores en la integración.
- ESLint móvil completo aprobado y control focal posterior de las pantallas SaaS y sesión.
- `git diff --check` sin errores de espacios.
- Expo compiló los bundles web/servidor tras separar el almacenamiento por plataforma. La herramienta de navegador no respondió a navegación, lectura ni captura, por lo que no hay evidencia visual de las pantallas ni prueba autenticada en dispositivos. El servidor Expo iniciado para esta comprobación se detuvo al terminar.

No se alteraron los cambios pendientes de comprobantes, íconos públicos u otras tareas anteriores.
