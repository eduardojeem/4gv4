/**
 * Lo que la agenda guarda como servicio («Corte clásico», «Perfilado de
 * barba») también vive en `products`, con la unidad «servicio». En el catálogo
 * público esos ítems no son productos: se muestran en la carta de servicios y
 * se reservan por la agenda. Este es el filtro de PostgREST que los deja afuera
 * (la unidad puede venir vacía, por eso el `is.null`).
 */
export const NOT_A_SERVICE_FILTER = 'unit_measure.is.null,unit_measure.neq.servicio'
