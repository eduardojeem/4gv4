# Seguimiento de reparaciones por QR en móvil — 2026-11-16

## Cambios
El lector interpreta URLs firmadas del comprobante (ruta global, ruta por comercio y query anterior). Acepta únicamente el origen configurado y los dominios oficiales; no abre enlaces ajenos ni transmite sus datos a otro servidor. Envía ticket, firma y comercio a la API de detalle, que conserva la validación del hash. Un código que contiene solo un ticket requiere el teléfono o email real del cliente. Se eliminó el teléfono ficticio.

Las respuestas autorizadas de consulta manual y QR incorporan nombre y slug reales del comercio, consultados con la organización de la reparación después de validar el acceso. Respuestas exitosas privadas y sin caché. No se ampliaron permisos ni se alteraron firmas.

La pantalla muestra comercio, equipo, estado legible y actualización manual; distingue pausa, cancelación y estado desconocido. Corrige el campo de contacto, los ejemplos de ticket y el mensaje de cámara. Limpia resultados al editar, buscar o cerrar y descarta respuestas tardías. El lector de cámara se desmonta al cerrarlo.

## Verificación
30 pruebas enfocadas: parser y mensajes, API con mocks, rechazo de QR inválido, ausencia de lectura del comercio sin autorización, filtros de organización y regresiones de firmas/URLs/esquema. TypeScript raíz y móvil y ESLint de archivos tocados.

React Native Web con fixtures en 375 y 768 px: QR firmado, comercio y estado, actualización con reparación inexistente (sin resultado viejo), consulta con contacto real, rechazo local de QR ajeno, sin errores de página ni desborde. Cámara, permisos físicos y lectura óptica en iPhone/Android pendientes; no se consultó producción.

## Límites
No es una suscripción en tiempo real: la persona toca Actualizar estado. Un backend anterior sin el campo store muestra Comercio no disponible. No requiere migración. Cambios locales sin commit, push ni deploy.
