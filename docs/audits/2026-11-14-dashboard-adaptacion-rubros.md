# Dashboard adaptado al rubro — 2026-11-14

Implementación local en C:/proyecto/mitiendapy. No se aplicaron migraciones ni cambios de datos, push o deploy.

## Comportamiento

- La presentación combina rubro declarado, modelo de operación y módulos efectivos. Una plantilla pública o el nombre de la empresa no cambian los permisos ni activan herramientas.
- Barbería, estética y negocios con modelo de servicios priorizan Servicios en POS. La elección manual se guarda separada por empresa/sucursal, sin modificar los carritos y ventas suspendidas existentes.
- El catálogo admite Servicios sin Inventario. El middleware transmite el alcance autorizado y el servidor restringe esos usuarios a registros con unidad canónica servicio. No permite convertirlos en mercadería ni gestionar productos físicos. Se verifican pertenencia y tipo antes de borrar en lote.
- El alta atómica de servicios requiere Servicios, configuración de agenda y permiso de creación, pero no Inventario. Conserva revisión de política, cuota, actor e idempotencia. Se usa el formulario de servicio para administradores; quienes solo gestionan catálogo conservan su alta permitida con unidad servicio predeterminada.
- Menú, título y encabezado muestran Servicios o Productos y servicios. Las cuentas sin Inventario no muestran el resumen de existencias ni cupo de productos. Cuotas solo se enlaza si está habilitado Créditos.
- La búsqueda utiliza empresa activa, permisos y módulos. Incluye productos, servicios, clientes, reparaciones y turnos cuando corresponden. Descarta respuestas tardías y cambia de instancia al cambiar empresa o capacidades. Los turnos encontrados abren su ficha y fecha; la consulta de agenda también lleva el identificador explícito de empresa.
- El inicio de negocios orientados a agenda muestra indicadores derivados de /api/agenda: turnos/atenciones del día, atendidos, ausencias, próximas reservas pendientes y próximo turno. La agenda es de la empresa completa, no se presenta como exclusiva de una sucursal. Hay carga, error y reintento; el servidor rechaza conteos pendientes fallidos en vez de devolver cero. Si alcanza el límite de 2000 filas, se advierte que los conteos del día son parciales.
- La agenda usa profesionales como término general y muestra la modalidad de atención. Sin turno cambia la acción a Registrar atención y propone la hora actual. Se impide activar nuevas reservas online desde configuración mientras la modalidad sea exclusivamente sin turno.

## Límites del alcance

- No se alteraron reservas ni configuración existentes en una base real. La modalidad sin turno no cancela automáticamente reservas previas ni borra su historial.
- Atención a domicilio se informa en el flujo; no se agregó logística, rutas de traslado ni un campo estructurado de dirección por turno. Las observaciones existentes continúan disponibles.
- Los registros antiguos identificados solo por nombre o SKU no se convierten automáticamente a servicios: se requiere clasificación explícita en la unidad del registro.
- No fue un rediseño manual de cada una de las 51 páginas inventariadas. Se corrigieron los mecanismos transversales y los flujos identificados en la auditoría.
- La validación visual del resumen se hizo con Chrome en 390 y 1280 px, con API ficticia aislada y sin desbordamiento horizontal. Las pruebas físicas y la revisión de cada rol con datos reales quedan para la prueba del usuario.

## Verificación

Pruebas focalizadas de contexto de servicios, autorización de catálogo, búsqueda multiempresa y respuestas tardías, resumen sin ceros falsos, prioridades y preferencias del POS. Regresión ampliada de productos/créditos/POS/agenda/navegación: 882 pruebas pasaron. Validar el resultado final de TypeScript y ESLint informado al cerrar la tarea.