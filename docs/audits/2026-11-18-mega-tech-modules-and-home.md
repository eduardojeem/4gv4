# Mega Tienda Tech: módulos y portada

## Alcance

Implementación local de las recomendaciones aprobadas para la plantilla `informatica-electronica`. No se modificaron módulos, preferencias ni datos de Dirac Store. Sin SQL, migraciones, publicación ni cambios nativos.

## Comportamiento

- La portada conserva título, subtítulo, badge y botones del editor, prioriza WhatsApp del comercio y presenta una foto real del catálogo. Sin inventario no reutiliza productos cacheados ni ofrece un CTA de catálogo. Con un solo departamento evita repetirlo en portada y sección de categorías.
- La consulta de ofertas es independiente de los últimos 32 productos. El encabezado, inicio y barra móvil comparten su clave SWR; solo ofrecen descuentos reales cuando la sección está publicada. Sin configuración disponible no anuncian ofertas.
- Reparaciones exige módulo efectivo y publicación pública. Se retira el bloque con garantías/certificaciones y se presenta seguimiento y consulta en un bloque compacto.
- Servicios requiere módulo y publicación. Reservas exige además sección habilitada y agenda pública disponible. Galería y procesos usan los componentes existentes; los procesos conocidos de reparación/compra se ocultan cuando no corresponden. El nuevo modo de texto de proceso no promete plazos ni coberturas.
- Los layouts propagan los módulos a los menús y al pie. La barra móvil de esta plantilla no ofrece carrito en modo WhatsApp, ni catálogo sin Inventario.
- El pie común anuncia solo métodos configurados y autorizados por los controles públicos, sin agregar cuotas, SIPAP o QR. Sin controles disponibles oculta esas etiquetas.
- Los servicios de esta plantilla sin teléfono usan el acceso a servicios del propio comercio como contacto alternativo.

## Verificación

- 126 pruebas aprobadas en 13 archivos: publicación, plantilla, navegación/pagos, capacidades, procesos, editor y arquitectura de plantillas.
- TypeScript raíz y ESLint de todos los archivos tocados aprobados, sin errores ni advertencias. `git diff --check` aprobado.
- Chrome con fixtures locales: 12 escenarios, en 390/1280 px y claro/oscuro. Catálogo/WhatsApp, negocio mixto con agenda, publicación oculta, servicios sin teléfono y sin agenda, catálogo vacío y título largo. Verificadas galería, proceso, apertura/cierre del menú y ausencia de errores JavaScript y desbordes.
- No se hizo una compra, reserva, cobro ni cambio de configuración en producción.
