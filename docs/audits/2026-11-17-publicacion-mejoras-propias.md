# Publicación de mejoras propias — 2026-11-17

## Alcance

- Dashboard POS: detalle adaptable, comprobantes fieles, cartera por ámbito y recargas verificables.
- Reparación móvil: Resumen/Servicio/Pagos, garantía, comprobantes agrupados y WhatsApp compacto.
- Reconocimiento de empresa: refresco por foco/contexto y distinción entre ausencia confirmada y errores de acceso.

Se recuperaron únicamente diferencias propias pendientes desde commits locales. La base es origin/main de41114c. Se preservan los cambios actuales del registro y la impresión al crear una reparación, el refresco compartido de cuentas y las mejoras de impresión térmica. No se incluyeron archivos de cosmética, scripts de inspección/carga ni otros cambios ajenos. El plan POS ya estaba publicado en main y se conserva.

## Conflictos

Detalle móvil: se conservaron nuevo/justCreated y el aviso de imprimir, junto con las pestañas y la hoja de documentos. La garantía queda en Resumen; el técnico en Servicio. Hook de cuenta: se combinaron imports de foco/contexto con el refresco compartido que ya existía en main.

## Verificación

- 158 pruebas de POS, recibos, posventa, traducciones e impresión térmica: aprobadas.
- 95 pruebas de contexto de empresa, navegación/registro móvil, caché, garantía, comprobantes y WhatsApp: aprobadas.
- TypeScript raíz y mobile: aprobados.
- ESLint raíz y mobile: sin errores; permanece la advertencia anterior openRegistration sin uso en mobile/src/app/index.tsx.
- Chrome con fixtures: POS ya verificado a 375/768/1440 px en claro/oscuro; reparación móvil recuperada verificada en cinco escenarios, incluido aviso de impresión al crear, sin desbordes ni errores JS.

No es una suite completa ni una prueba física de teléfono/impresora. No se accedió a producción, no hay migraciones y no se hace merge ni deploy. Publicar Git no actualiza automáticamente el APK/TestFlight instalado.
