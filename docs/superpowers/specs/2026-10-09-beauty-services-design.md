# Belleza, especialidades y preparación de páginas de servicios

## Objetivo y decisiones aprobadas

Ampliar el sistema para negocios de barbería, peluquería, uñas, pestañas, cejas,
maquillaje y estética. Separar actividad, forma de trabajo y presentación pública.
Cosmética y belleza continúa siendo el rubro de venta de productos; Belleza y
cuidado personal será el nuevo rubro de servicios. No se eliminarán ni regenerarán
servicios, profesionales, tarifas, citas o productos al cambiar de perfil o diseño.

## Enfoque

Extender el perfil y la configuración web existentes, sin un segundo sistema de
reservas. Mantener el identificador `barbershop` y su comportamiento para cuentas
existentes; agregar `beauty_services` para el rubro amplio. No convertir cuentas
automáticamente. Reutilizar los renderizadores de servicios y la agenda existente.

Alternativas descartadas: renombrar y migrar automáticamente todas las barberías
confunde negocios existentes; crear agendas distintas por especialidad duplica
reglas de disponibilidad, permisos y cobro.

## Perfil del negocio

- Especialidades múltiples mediante una lista validada: barbería, peluquería,
  uñas, pestañas, cejas, maquillaje, estética y otros servicios.
- Forma de trabajo independiente: conservar los modelos actuales, incluyendo
  servicios y mixto. Las recomendaciones de módulos no conceden derechos del plan.
- Modalidad de atención: local, domicilio o ambas; modalidad de turnos: reservas,
  sin turno o ambas. Estos datos describen la atención, no crean logística,
  rutas, turnos sin disponibilidad ni funciones que la agenda no soporte.
- Los campos nuevos son opcionales para clientes anteriores. Omitirlos en una
  actualización conserva el valor guardado; vaciarlos requiere enviar la lista vacía.
- No inferir especialidades de una plantilla. No confundir especialidades con
  categorías del marketplace ni con el rubro de productos cosméticos.

## Servicios y reservas

Las categorías de servicio son editables y permiten servicios personalizados.
Los ejemplos de cada especialidad serán sugerencias, nunca altas automáticas.
Mantener precio, duración, preparación y profesionales configurados. El recorrido
público conserva servicio, profesional disponible o cualquiera, fecha/hora y
confirmación. Los valores acordados se validan en el servidor con los contratos
actuales de reserva; cambiar la estética no puede modificar ese contrato.

## Página de servicios

Cambiar el texto de preparación a «Preparar mi página de servicios» para negocios
de servicios. Ofrecer cuatro variantes: Barbería, Salón de belleza, Estudio de
belleza (uñas/pestañas/cejas) y Servicios profesionales. La plantilla `beauty`
actual, destinada a comercio de cosméticos, conserva su uso independiente.

Las variantes comparten el renderizador de servicios y cambian textos, paleta y
presentación. Estudio de belleza ofrece una propuesta marfil/rosa suave/malva,
editable y con contraste accesible; ninguna especialidad obliga a ese estilo.
No generar fotografías ni afirmar experiencia, resultados o cifras inexistentes.

El asistente determinista, sin proveedor de IA, pregunta especialidades, estilo y
colores. Produce una propuesta editable y una vista previa de servicios reales.
Preparar o previsualizar no modifica la página pública. Aplicar requiere una acción
explícita de confirmación con resumen de textos y opciones que serán reemplazados.
El perfil puede guardarse sin aplicar la propuesta. No se promete una separación
general de borrador/publicación para todo el editor web: el alcance es esta propuesta.

## Integración y persistencia

Extender los contratos de `business-profile.ts`, lectura del plan/contexto y
`BusinessProfileCard`, además del alta del negocio. Persistir datos nuevos con
migración aditiva, validación equivalente en servidor y base de datos y valores
compatibles para organizaciones anteriores. Entregar la migración al usuario;
no aplicar SQL remoto ni desplegar producción como parte de esta aprobación.

Separar la generación pura de propuestas de `vertical-website-preset.ts` de su
aplicación actualmente inmediata en `/api/admin/organization-profile`. El cliente
no decide qué organización se modifica: usar el contexto autorizado del servidor.
La confirmación aplica únicamente claves permitidas de configuración web y debe
detectar si la configuración original cambió desde la vista previa; devolver
conflicto sin sobrescribir modificaciones concurrentes.

Conservar nombre, logo, contactos, cuentas bancarias, servicios y configuración de
agenda. Los ajustes de cobro/carrito existentes no se cambian por elegir una variante
visual de servicios. Registrar cambios de perfil y aplicación de propuestas en la
auditoría del tenant. Revalidar los consumidores públicos afectados después de una
escritura exitosa. Una falla no puede presentarse como publicación exitosa.

## Seguridad y errores

Mantener `settings.manage`, aislamiento por organización y restricciones de plan.
Validar listas, variantes, colores y longitudes; textos públicos se renderizan como
texto, no HTML arbitrario. La vista previa y confirmación requieren la misma
autorización. Guardar el perfil no habilita automáticamente reservas públicas sin
módulo, servicios activos y disponibilidad real. Mostrar errores recuperables,
cambios pendientes y conflicto de propuesta desactualizada.

## Verificación y aceptación

1. Contratos: cuentas anteriores y solicitudes sin campos nuevos conservan valores;
   especialidades/variantes inválidas son rechazadas.
2. Tenant y permisos: ninguna operación puede leer o escribir otra organización;
   módulos no incluidos siguen bloqueados.
3. Preparación: generar y editar vista previa no escribe configuración pública;
   confirmar aplica solo claves permitidas; conflictos no sobrescriben cambios.
4. Integridad: cambiar plantilla no altera filas de servicios, profesionales,
   reservas, precios acordados, productos ni cuentas de pago.
5. Consumidor: las cuatro variantes muestran servicios y reservas reales, mientras
   cosmética comercial y las barberías anteriores mantienen su comportamiento.
6. Interfaz: estados vacíos/carga/error, navegación por teclado y revisión a
   320, 768, 1024 y 1440 px. Sin prometer funciones no habilitadas por el plan.
7. Ejecutar pruebas focalizadas, lint/tipos y build proporcional al cambio;
   distinguir resultados locales de prueba autenticada y despliegue remoto.

## Fuera de alcance

Nuevos planes, pasarelas de pago, reservas recurrentes, geolocalización a domicilio,
generación de imágenes, chat con IA, cambios de tarifas existentes y publicación
automática en producción.
