# Promociones nativas

Alcance autorizado: descuentos y publicación (cupón u oferta por producto/servicio), fidelización y campañas, clientes y métricas, administración de sorteos con participantes/ganadores. Misma API y permisos que web. Formularios con teclado desplazable, validación y errores legibles; sin producción, push o deploy.

1. Corregir el cliente autenticado por Bearer y el sorteo sin elevación de privilegios.
2. Modelos y cliente API tipado con validación local y control de acceso.
3. Pantalla nativa en /panel/promotions y capacidades en el menú existente.
4. Probar auth, permisos, validación, estados de sorteo, navegación y formularios con fixtures. Tipos web/móvil, lint y bundle Expo.

No se requiere otra migración: la de fidelización por turnos de la tarea anterior sigue pendiente de aplicación. Sin ella, mostrar su dependencia sin inventar datos. No crear una segunda lógica de puntos en la app.