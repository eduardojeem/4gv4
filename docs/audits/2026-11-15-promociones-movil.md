# Promociones nativas — 2026-11-15

Implementación local en C:\proyecto\mitiendapy. Sin push, merge, deploy ni escrituras en producción. No se modificó la worktree de Claude que atendía el puerto 3000.

## Acceso y comportamiento

Ruta Expo Router: /panel/promotions. Se abre desde el menú existente del panel; Promociones ahora se reconoce como sección nativa. Las cuatro pestañas se muestran completas en dos columnas en celulares y en una fila en pantallas amplias. Colores del comercio y contraste de texto mediante los mismos helpers del menú nativo.

- Descuentos: listar y buscar en todas las páginas, crear, editar, pausar/habilitar y eliminar con confirmación. Por porcentaje o monto; uso interno, cupón público u oferta automática. Selección de productos/servicios y categorías, fechas, mínimos, límites y ejemplos de formato. Una oferta automática exige porcentaje y productos/servicios seleccionados.
- Fidelización: configurar programa por monto, turnos o ambos, conversión, canje, topes y vencimiento. Crear, editar, pausar y eliminar campañas. Explicación distinta para acreditaciones del programa anterior y turnos del nuevo. No se calcula ni se modifica el saldo en la app.
- Clientes: métricas reales del negocio, búsqueda y páginas de 25, progreso separado de visitas, canje por saldo a favor e historial de puntos/números/premios según permiso de clientes. El historial indica el límite de 200 movimientos y muestra 20 por vez. Canjes requieren el mismo permiso que web (POS o gestión de clientes).
- Canjes: intento persistido en SecureStore, vinculado a usuario, organización, cliente, monto y referencia. Una respuesta incierta conserva la referencia y permite reanudar. No se reemplaza un canje incierto por otro cliente/monto ni se envía si cambió la sesión durante la persistencia. El servidor mantiene la validación de saldo y el canje atómico existente.
- Sorteos: crear borrador con premios y condiciones, editar los campos permitidos, publicar, cerrar/cancelar según ciclo de vida, ejecutar el sorteo y consultar participantes y ganadores. Participantes paginados. No se reabre un estado terminal ni se eligen ganadores en el cliente.

Los formularios reutilizan BottomSheet y KeyboardFormScroll del proyecto: área desplazable y acción de guardado separada del contenido. Se conservan los campos tras un error. Fechas en la zona horaria del celular, indicada en el formulario, con validación de fechas imposibles.

## Backend y permisos

- Contratos compartidos extraídos a src/lib/loyalty/contracts.ts; la web conserva sus exportaciones existentes.
- createOrgScopedClient ahora conserva Authorization: Bearer de la app, además de x-organization-id tomado del contexto ya validado. El flujo web sigue usando sus cookies. No se usan claves administrativas en la app.
- El dashboard móvil expone las capacidades de promociones y lectura de clientes mediante los mismos permisos del servidor. Los controles de escritura se ocultan en acceso de consulta; las API vuelven a validar permisos y módulo.
- Sorteo: se valida que pertenezca a la organización activa y se conserva al actor autenticado. Se eliminó el fallback que reintentaba con cliente administrador ante un rechazo de permisos. Un sorteo publicado cuya fecha ya venció sigue siendo sorteable desde web; móvil ofrece el cierre explícito antes de elegir ganadores.
- Detalle de sorteo: errores de tickets/ganadores no se convierten en listas vacías, ambas consultas filtran organización y móvil solicita páginas de 25 números. La consulta web sin page mantiene su contrato anterior.
- Si PostgREST no devuelve toda la participación, el listado indica que el número de participantes no está confirmado en lugar de inventar un total con la primera tanda. Los números emitidos conservan su conteo real de la relación.
- Estado reiniciado al cambiar usuario, negocio, sucursal, permisos o acceso; respuestas antiguas no repueblan otra sesión. Se distinguen errores de red, permisos, módulo desactivado y plan que no incluye promociones.

## Migraciones y publicación

No se creó ni aplicó una migración nueva en esta tarea. Para el conteo por turnos y las métricas de clientes se necesita la preparada anteriormente:

supabase/migrations/20261115161607_loyalty_service_program.sql

Sin ella, la configuración por monto permanece disponible y las capacidades nuevas explican su dependencia. Los cambios móviles necesitan el backend actualizado para recibir sus capacidades y autenticarse correctamente en puntos/sorteos. No se sincronizó con otro servidor ni se publicó.

## Validación

- 322 regresiones en 34 archivos pasaron: fidelización y canjes SQL con PostgreSQL embebido, reglas y sorteos, promociones web, navegación y contexto móvil, contratos API y reintentos. Otras 3 pruebas específicas de conteos completos/truncados y errores también pasaron: 326 pruebas en total, 35 archivos, incluida una regresión adicional para no informar como fallido un canje confirmado si falla limpiar su referencia local.
- TypeScript raíz y mobile sin errores. ESLint de los archivos tocados sin errores; comprobación final y diff --check registrados en la sesión.
- Chrome con React Native Web, componentes nativos y servicios interceptados, a 375 y 768 px: creación de oferta para servicio, configuración de visitas, campaña, error/reintento de clientes, canje con respuesta incierta y reintento de la misma referencia (una sola transacción), historial, sorteo como borrador, ejecución una sola vez y acceso de consulta. Sin errores de página ni desbordes; las cuatro pestañas dentro del ancho visible.
- Se usaron proveedores de sesión, API, iconos y almacenamiento ficticios para la revisión visual. No representa una sesión de producción.
- Bundle iOS/Expo Go final compilado con Metro local offline: HTTP 200, 16.125.287 bytes, con las rutas y componentes de descuentos, fidelización, historial, sorteos y canjes presentes. Metro temporal cerrado al terminar. No se probó físicamente en iPhone/Android; teclado y áreas seguras en dispositivo siguen pendientes de prueba manual.