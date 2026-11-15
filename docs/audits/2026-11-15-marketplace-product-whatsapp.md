# Consultas por WhatsApp desde productos — 2026-11-15

Implementación local en C:/proyecto/mitiendapy, sin migración, push ni deploy.

## Comportamiento

- Botón Consultar por WhatsApp en tarjetas del marketplace (listado, carruseles y productos por empresa), tienda pública, detalle web, tarjetas Expo y ficha nativa.
- Número exclusivamente de la empresa del producto; dentro de una ficha de sucursal, prioridad a su teléfono válido con respaldo de la empresa. Sin usar soporte de la plataforma para el enlace nuevo.
- Mensaje con nombre y URL del producto. Si el precio está oculto, pregunta por el precio sin incluirlo. Se conservan las consultas detalladas existentes de variantes y ofertas.
- Configuración company_info.productWhatsappEnabled: habilitada por defecto para empresas con número válido; false oculta los botones de consulta de productos. No modifica pedidos existentes, carrito ni la modalidad de compra.
- Control web junto al campo WhatsApp de Sitio web → Información de contacto. Control Expo en Admin → Sitio web → Negocio, horario y mapa → Contacto y ubicación.
- El campo pasa por CompanyInfoSchema, guardado existente, catálogo público y API del marketplace móvil. No requiere tablas ni migraciones nuevas.
- Validación de formato del número, conservación de números internacionales explícitos y formato paraguayo local; no certifica que el número tenga una cuenta activa de WhatsApp.
- Links accesibles con altura mínima 44 px, destino externo protegido y eventos aislados para que no abran también la tarjeta. En Expo se informa si no se puede abrir el enlace y no se presenta un botón sin contacto válido.

## Verificación observada

91 pruebas enfocadas aprobadas en 13 archivos, incluyendo configuración, catálogo móvil, precios ocultos, variantes, ofertas, clics, contactos y persistencia al editar otro dato.

TypeScript raíz y mobile con salida 0. ESLint sin errores; una advertencia previa por openRegistration sin uso en mobile/src/app/index.tsx. git diff --check del alcance sin errores.

Chrome con componentes reales y red simulada a 390 y 1280 px: destino correcto, configuración deshabilitada sin botón, sin desbordamiento horizontal ni errores de consola. Capturas marketplace-whatsapp-390.png y marketplace-whatsapp-1280.png en la carpeta de visualizaciones de la sesión.

Bundle iOS completo de Metro con transform.routerRoot=src/app y lazy=false: HTTP 200, 15.957.043 bytes. Se comprobó que contiene productWhatsappEnabled, productWhatsappInquiryHref y product-detail-sheet, para verificar los cambios de la aplicación y no solamente el router.

No se enviaron mensajes ni se ejecutaron operaciones contra producción. Falta probar la apertura de WhatsApp en un teléfono físico. Los ajustes públicos pueden requerir recargar el catálogo según la invalidación y caché existentes.