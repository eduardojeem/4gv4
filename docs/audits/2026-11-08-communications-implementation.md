# Comunicaciones: correcciones

## Implementado
- Respuestas asíncronas del historial vinculadas al mensaje abierto; se descartan respuestas anteriores y se capturan fallos de conexión.
- Nuevo aviso en borrador; publicar exige revisión de destino y contenido. Cierre bloqueado durante guardado, errores visibles y borradores conservados.
- Programación nueva requiere fecha futura. Una edición puede conservar exactamente la programación previa.
- La página y el GET de superadmin no publican al consultar.
- Estadísticas separan enviados, pendientes y otros estados; alcance visible de 300 avisos/500 mensajes; error de conteo de fallidos no se presenta como cero exitoso.
- Configuración de email separada de entrega comprobada. La prueba informa aceptación por proveedor, conserva destinatario y captura error de red.
- Pestañas y filtros persistentes en URL; controles y pestañas adaptados a móvil.

## Worker preparado, pendiente de activación
POST /api/cron/communications requiere Authorization: Bearer con el CRON_SECRET del entorno. Sin secreto devuelve 503; sin autorización 401. Ejecuta la RPC existente dispatch_due_global_notifications. No necesita migración.
No se agregó una frecuencia a vercel.json ni se activó un scheduler: antes de prometer puntualidad debe conectarse un scheduler compatible con el hosting (por ejemplo cada minuto o cada cinco minutos), desplegar y verificarlo. Mientras tanto se conserva el despacho legacy al consultar avisos desde una tienda, por compatibilidad.
No probar este endpoint contra producción durante QA: publica avisos reales. Los tests usan RPC simulada.

## Verificación
14 pruebas del alcance, ESLint y TypeScript aislado sin errores. Chrome con fixtures, APIs interceptadas: borrador, revisión sin solicitud, error que conserva datos, estados, URL, móvil claro/oscuro sin desbordamiento. El primer chequeo global detectó errores de JSX ajenos al alcance. El chequeo global final de TypeScript pasó con exit 0; no se modificó el archivo ajeno desde esta tarea.
Sin envíos reales, datos remotos, migraciones, commit, push o deploy.
