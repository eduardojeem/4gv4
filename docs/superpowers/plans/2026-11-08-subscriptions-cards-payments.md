# Suscripciones: lista, tarjetas y pagos

Continuación autorizada del rediseño: mejorar claridad, accesibilidad y acciones en /superadmin/subscriptions?q=4g-technology.

1. Reproducir: fecha de prueba distinta del ciclo, sin fecha presentado como perpetuo y teclado que activa dos controles.
2. Unificar fecha efectiva, gestión de pagos e historial entre vistas. Tarjetas con acciones explícitas y etiquetas de uso. Tabla conserva densidad.
3. Separar registro de cobro manual de proveedor online; selector de medio con ayuda, reset de monto al cambiar plan y confirmación existente.
4. Tests enfocados, tipos, ESLint y Chrome con fixtures.

Sin cambios en APIs, migraciones, producción, commit, push o deploy. Conservar trabajo previo y de Claude. No inferir cobro confirmado ni disponibilidad de un proveedor desde el estado de suscripción.

Completado: 60 pruebas, TypeScript, ESLint y Chrome con datos ficticios. Alineación de tabla comprobada a 1280/1440/1920; tarjeta y pagos a 375 px. Sin APIs ni base de datos modificadas.
