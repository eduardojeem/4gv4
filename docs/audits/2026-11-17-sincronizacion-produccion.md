# Sincronización para producción web — 2026-11-17

## Alcance autorizado

Revisar e integrar trabajos recientes de Claude, Gemini y Codex; publicar web/API. El usuario indicó «por ahora solo web»: no generar APK ni TestFlight. Sin migraciones ni modificaciones de datos de producción.

## Integración

- Main ead9d219: sincronización previa #130, reparación recién registrada #131, recibos de pedidos #132, longitud de impresión térmica #133, plantilla cosmética e imágenes.
- Codex 5f5964a2: POS, reparación móvil y reconocimiento de empresa.
- Los cambios se integran en release/sync-2026-11-17 conservando las mejoras térmicas y la opción de imprimir al registrar. No se ejecutan scripts de inspección ni semillas.

## Correcciones de revisión

La plantilla cosmética sustituía catálogos vacíos por productos inventados, mostraba descuentos y valoraciones estáticos, asignaba cantidades ficticias a categorías y completaba teléfono/dirección/logo de otro negocio. Se conservó el diseño y se eliminó esa sustitución: productos/ofertas y conteos proceden del comercio; sin datos, se informa carga, error o vacío. Los contactos y la ubicación solo se ofrecen cuando están configurados. Se retiran cupones, plazos, avales y beneficios no respaldados por configuración. Las imágenes editoriales permanecen ilustrativas.

## Despliegue

Proyecto Vercel 4gv4, team_oGfcm0pWJoWCZVaVgyFNhi2T / prj_7Mr3VuY5H1beIA2dYPTT66LRDG93. Producción anterior: ead9d219, deployment dpl_DuqSnRJinSXEnPy4wVXRymgvvbWR, READY. Es candidato a rollback.

El workflow manual Deploy de GitHub falla por ausencia de secretos VERCEL_TOKEN/ORG_ID/PROJECT_ID; la integración Git de Vercel sí publica main correctamente. No se solicitan ni copian secretos: se verifica y usa el mecanismo Git existente.

La publicación queda condicionada a pruebas completas, tipos, lint, build/preview y revisión del commit exacto. Se documentará el resultado y el identificador de producción al finalizar. No equivale a una prueba física de impresora o teléfono.

## Revisión adicional

- Se inventariaron worktrees sin modificarlas. Las copias antiguas con modificaciones entre agosto y el 7 de noviembre quedan preservadas fuera de esta publicación; la copia POS del 17 de noviembre ya se recuperó en la candidata. No se mezclan snapshots incompletos con miles de eliminaciones.
- Se corrigió el desborde del encabezado cosmético a 375 px: marca flexible, nombre truncado visualmente, controles visibles y estado accesible del menú.
- Chrome aprobó ocho escenarios cosméticos: 375/1280 px, claro/oscuro, catálogo con producto y catálogo vacío, apertura/cierre del menú móvil, sin desbordamiento ni errores JavaScript.
- La candidata inicial compiló correctamente en Vercel y /paravos/inicio respondió 200. Las ofertas guardadas por el comercio se conservan; se elimina la generación de ofertas ficticias desde la plantilla.

## Cambios concurrentes incorporados

Se integra también feb0a398: carrusel boutique propio y diseño separado de ofertas de Gemini. Se conserva el estilo visual, pero la grilla usa ofertas reales del catálogo; los productos sintéticos no regresan. Se corrigen y prueban índice seguro al quitar banners, pausa manual persistente, movimiento reducido, pausa por foco y enlace de compra por comercio. El tag release/web-2026-11-17-cut conserva el corte anterior como respaldo; no implica detener la publicación solicitada.

## Integración posterior a la finalización de Gemini

Se incorpora main 3ec2511e: enlaces a /ofertas de Gemini y PR #135 de Claude (consulta del detalle POS sin relación inexistente payments; consulta legacy separada y filtrada; service worker solo para estáticos). Se preservan useSales(false), el diseño adaptable y ofertas del catálogo real. También se retiran dirección y horarios ficticios del footer. La publicación sigue limitada a web/API.
