# Reputacion verificada de organizaciones

## Objetivo

Dar credibilidad comprobable a las organizaciones sin impedir que cualquier visitante comparta una opinion honesta.

## Reglas de producto

- Las reseñas abiertas siguen permitidas y se identifican como `Opinion abierta`.
- Una reseña solo usa `Compra verificada` o `Reparacion verificada` cuando el servidor la vincula a una venta o reparacion de la misma organizacion.
- El promedio general incluye todas las reseñas publicadas. El promedio verificado se presenta por separado; no hay ponderacion oculta.
- El negocio puede responder y moderar contenido, pero nunca editar el texto ni la puntuacion del cliente.
- Ocultar o rechazar requiere un motivo y conserva el registro. La eliminacion permanente deja de ser una accion ordinaria.
- Las reseñas heredadas permanecen publicadas como opiniones abiertas.
- Los enlaces publicos usan la ruta canonica `/{slug}/inicio#resenas`.

## Experiencia publica

- Resumen con promedio general, cantidad publicada, cantidad verificada y distribucion por estrellas.
- Filtros `Todas`, `Verificadas`, `Compras` y `Reparaciones`.
- Paginacion real y estados de carga, error y vacio.
- Cada tarjeta muestra el tipo de verificacion y la respuesta oficial cuando exista.
- El formulario informa que la reseña queda pendiente y usa Turnstile cuando esta configurado.

## Experiencia administrativa

- Bandeja con estados explicitos: `pending`, `published`, `rejected`, `hidden` y `reported`.
- Filtros por estado y tipo de verificacion.
- Detalle con evidencia minima, respuesta publica, motivo de moderacion y fechas.
- Metricas consistentes calculadas solo sobre las reseñas publicadas, mas conteos de verificacion y respuesta.
- Solicitud general con copy neutral. Los enlaces verificados quedan soportados por contrato de API para conectarlos a ventas y reparaciones.

## Seguridad y multitenencia

- Toda gestion administrativa permanece protegida por `withAdminAuth` y `organization_id`.
- Los tokens de invitacion se almacenan hasheados, tienen vencimiento, uso unico y origen comprobado.
- La API publica resuelve primero la organizacion y limita por organizacion e IP.
- Las tablas nuevas usan RLS; el cliente publico no recibe emails, identificadores de cliente ni IDs de transaccion.

