# Preparar mi negocio: recorrido hasta la primera operación

## Objetivo y alcance

Guiar al propietario o administrador desde el registro de la organización hasta su primera operación real. Reutilizar `/admin/onboarding`, el perfil de negocio y el dashboard existentes. Sin IA, cambios automáticos de permisos, operaciones financieras de prueba ni publicación remota.

El rubro propone; la forma de trabajo determina el recorrido. Un negocio mixto puede vender productos y servicios. La persona puede continuar después y cambiar su perfil sin borrar configuraciones.

## Situación encontrada

- `business-profile.ts` ya define rubros, forma de trabajo y sugerencias de módulos.
- `OnboardingClient.tsx` ya presenta pasos de empresa, catálogo, equipo, web y agenda, pero no constituye una verificación completa de la primera operación.
- `/api/onboarding/status` considera datos básicos, contactos y finalización explícita. No debe reutilizarse su bandera `completed` como prueba de que hubo venta, prestación o cobro.
- El dashboard ya dispone de contexto de organización, sucursal, permisos y plan.

## Experiencia

1. Después del registro, reutilizar selección de rubro y forma de trabajo. Preguntar si trabaja solo o con equipo como preferencia opcional, sin crear empleados automáticamente.
2. Mostrar «Preparar mi negocio» en el dashboard con progreso, siguiente tarea, enlace directo y «Continuar después». Permitir volver a abrir la guía.
3. Separar requisitos para comenzar de recomendaciones opcionales. Nombre, moneda, zona horaria y sucursal operativa son básicos. Logo, web, redes, promociones, fidelización y comisiones son opcionales.
4. Cada tarea se completa por evidencia persistida, nunca por visitar la pantalla o marcar una casilla. Datos no disponibles muestran «No se pudo comprobar», no éxito ni cero.
5. Explicar la primera operación dentro del flujo existente mediante una ayuda contextual no bloqueante. Nunca guardar, cobrar ni abrir caja automáticamente.
6. Al detectar la primera operación persistida, mostrar su tipo y una próxima acción relevante. No confundir primera reserva con primera prestación o primer cobro.

## Recorridos

| Forma de trabajo | Preparación mínima sugerida | Hitos separados |
| --- | --- | --- |
| Comercio minorista/mayorista | Producto vendible, precio válido y condiciones de disponibilidad | Primera venta completada; cobro cuando corresponda |
| Barbería, belleza y otros servicios | Servicio activo, precio/duración, disponibilidad; profesional si el negocio lo requiere | Primera reserva; servicio realizado; cobro registrado |
| Taller | Condiciones de recepción y servicio; técnico opcional según flujo actual | Primera reparación recibida; entrega; cobro registrado |
| Mixto | Tareas de los módulos efectivos elegidos | Primera operación por canal, sin obligar a estrenar todos |

No exigir stock positivo a servicios ni exigir cliente identificado cuando POS permite consumidor final. Caja abierta es requisito de las operaciones que realmente lo demandan, no de todo el onboarding. Una reserva no garantiza ingresos ni comisiones.

## Arquitectura y persistencia

- Añadir un evaluador puro de tareas según perfil, módulos efectivos, permisos y evidencia de preparación/operaciones.
- Consultar evidencia mediante un endpoint autenticado de guía, separado del endpoint que decide redirecciones iniciales. Resolver la organización en servidor; validar sucursal y filtrar todas las consultas por organización. Usar agregados acotados/exists, no cargar catálogos completos ni datos personales de clientes.
- Reutilizar lectores existentes donde tengan contratos adecuados. Confirmar en el plan los estados reales de ventas, reparaciones, reservas y cobros antes de escribir consultas; no inventar equivalencias.
- Guardar solo preferencias de guía (trabaja solo/con equipo, posponer/ocultar y versión) en el espacio de configuración de organización, con autorización de administrador y actualización que preserve otros ajustes. No guardar duplicados de saldos, stock, ventas o estados calculados.
- Invalidar estado tras completar formularios y al cambiar organización/sucursal. Ignorar respuestas de contextos anteriores. Reabrir guía aunque se haya pospuesto.
- No ampliar el plan ni activar módulos no contratados. Mostrar tareas de módulos accesibles; si un canal carece de integración comprobable, declarar esa limitación en lugar de inventar un hito.

## Primera operación y demostración

La guía acompaña formularios actuales y conserva sus validaciones. Los pasos de revisión, guardado y cobro quedan bajo control humano.

La demostración será inicialmente una explicación interactiva de pasos con datos ilustrativos en memoria, claramente marcada «Demostración: no registra operaciones». No llama endpoints de ventas, caja, stock, reservas ni reparaciones. Un sandbox transaccional completo queda fuera de esta primera entrega.

## Seguridad y compatibilidad

No modificar cuentas ya configuradas, estados financieros ni registros históricos. Los empleados sin acceso de configuración no reciben botones administrativos. No convertir una cuenta de cliente comprador del marketplace en una organización. La guía solo corresponde a quien administra un negocio registrado.

## Verificación y aceptación

- Pruebas de recorridos de comercio, servicios, taller y mixto; plan limitado y rol sin permisos.
- Pruebas de evidencia incompleta, error de consulta, organización/sucursal cambiada y ausencia de datos.
- Diferenciar reserva, servicio, venta completada y cobro, incluyendo venta a crédito.
- Verificar que finalizar onboarding no marca primera operación y que una visita no completa tareas.
- Confirmar que posponer/reabrir no borra configuraciones y que la demo no usa endpoints mutantes.
- TypeScript, lint y pruebas focalizadas antes de la suite global y build.
- Navegación autenticada en escritorio y móvil, sin transacciones reales de prueba ni ejecución remota de SQL.

## Entrega

Primero guía de preparación y progreso en dashboard; después ayudas contextuales y demostración sin persistencia. Entregar instrucciones de migración solo si el plan determina que el almacenamiento existente no es suficiente. No publicar ni migrar automáticamente.
