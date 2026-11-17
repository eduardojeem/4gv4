# Avisos y comprobantes de reparación por WhatsApp — 2026-11-16

## Uso móvil
Detalle de reparación → Cliente → Avisar estado por WhatsApp. Se consulta el estado persistido, se prepara un borrador con cliente, comercio, equipo, ticket y enlace firmado de seguimiento. La persona revisa el destinatario, puede editar el texto y abre WhatsApp. El envío final se confirma allí; abrir el chat no se registra como mensaje enviado.

Comprobante de reparación → PDF para WhatsApp. Genera siempre la copia para el cliente, incluso si quedó seleccionada Ficha técnica simple. Usa el menú nativo para elegir WhatsApp y el chat. No adjunta archivos mediante wa.me, no selecciona un destinatario automáticamente y no usa WhatsApp Business Platform ni plantillas automáticas. Imprimir y Compartir PDF generales se conservan.

## Validación y acceso
GET /api/repairs/[id]/share reutiliza el guard de reparaciones y consulta por negocio/sucursal autorizados. Devuelve solo teléfono validado, borrador, estado y fecha de preparación, con private/no-store. No escribe mensajes, estados, pagos ni auditorías de entrega ficticias. Normaliza teléfonos locales de Paraguay cuando el país está confirmado; conserva prefijos internacionales y rechaza números ambiguos o faltantes. No se usa un contacto de plataforma como sustituto.

La app descarta borradores y respuestas de otro contexto de sesión/permisos. Sin conexión o con teléfono inválido muestra un error y permite corregir los datos. El PDF reutiliza la validación de contexto y la limpieza del archivo temporal existentes.

## Verificación
Pruebas de teléfono, mensaje con saltos de línea, estados y acceso al endpoint, junto con regresiones de PDF, recibos, garantías y etiquetas. TypeScript raíz y móvil y ESLint de lo tocado.

React Native Web en 375 y 768 px con módulos nativos y BottomSheet simulados: edición del borrador, enlace al destinatario esperado, teléfono inválido, PDF de cliente aunque se eligió ficha técnica y limpieza de temporales. Sin errores de página ni desborde. No se enviaron mensajes reales. Pendiente probar WhatsApp, adjunto PDF y teclado en iPhone/Android físicos.

Sin migración, producción, commit, push ni deploy. Documentación oficial consultada: https://faq.whatsapp.com/5913398998672934 y https://docs.expo.dev/versions/v57.0.0/sdk/sharing/.
