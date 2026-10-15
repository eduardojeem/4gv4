# Guía de preparación del negocio

## Uso

En el dashboard y en `/admin/onboarding`, propietarios y administradores ven «Preparar mi negocio». La guía propone tareas según la forma de trabajo y los módulos efectivos del plan. Cada requisito muestra Comprobado, Pendiente o No se pudo comprobar; visitar un formulario no lo completa.

Elegir Trabajo solo o Trabajo con equipo modifica únicamente la preferencia de guía. Continuar después la reduce a un acceso para reabrirla. Comprobar avance vuelve a consultar los datos guardados. Logo y página pública son recomendaciones opcionales.

Los enlaces de primera venta, reserva o reparación muestran ayuda en POS, Agenda o Reparaciones. La demostración recorre instrucciones en memoria: no registra operaciones, abre caja, modifica stock ni cobra dinero.

## Migración local pendiente

`supabase/migrations/20261013233736_business_start_guide_preferences.sql`

La función guarda solo `organization_settings.modules.business_start_guide` y preserva otras claves. Usa SECURITY INVOKER, acceso service_role y validación del actor activo owner/admin. No crea ventas, turnos, personal ni movimientos financieros.

No se aplicó remotamente. Revisar proyecto de destino y respaldo; ejecutar el archivo completo una vez. Si ya fue aplicado manualmente, comparar su definición antes de registrar el historial. No reparar una versión como aplicada solo por su nombre. Sin la función, la lectura puede funcionar, pero guardar preferencias muestra un error y no simula éxito.

## Límites explícitos

- La guía no certifica que todo el negocio esté listo para cualquier operación; los formularios mantienen sus validaciones reales.
- El catálogo se comprueba por organización. Con sucursal seleccionada, revisar disponibilidad real en el flujo operativo.
- Agenda no tiene atribución de sucursal comprobable para estos hitos; seleccionar toda la organización para consultarlos.
- El primer cobro no se infiere de una venta a crédito o una reserva. El hito permanece desconocido mientras no exista lectura canónica verificada de todos los canales.
- Finalizar la configuración inicial no equivale a primera venta, prestación o cobro.
- Los requisitos previos del formulario de configuración existente permanecen vigentes; esta guía no cambia sus validaciones de contacto.

## Comprobación

Validar con una organización de prueba los recorridos de comercio, servicios, taller y mixto; continuar después/reabrir y cambiar sucursal u organización. No generar operaciones reales para probar la demostración.

Las pruebas focalizadas y SQL local no sustituyen suite global, build, revisión visual autenticada ni aplicación remota. El despliegue no se realizó como parte de esta implementación.

## Verificación del 14 de octubre de 2026

Desde `C:\proyecto\mitiendapy`, el build completo y sus 14 controles posteriores pasaron. La comprobación remota de solo lectura confirmó que el cuerpo de `server_save_business_start_guide_preferences` coincide con este SQL y que solo `service_role` puede invocarlo. La versión `20261013233736` todavía no figuraba en el historial consultado; no se volvió a ejecutar el SQL ni se reparó el historial durante esa comprobación.
