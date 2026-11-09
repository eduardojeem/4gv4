# Auditoría de suscripciones

## Corregido
- Consulta inicial separada de edición y pago. Revisión explícita antes de confirmar cambios o cobros.
- Fechas sin editar conservan el ISO exacto; cambios se envían con zona explícita.
- Una cuenta activa con fecha de prueba residual no cuenta como prueba.
- Precio ausente se muestra como Precio sin definir.
- Montos enteros en guaraníes: se rechazan negativos, decimales y fechas inválidas/futuras.
- Guardas de solicitudes en curso y recuperación del borrador ante error.
- Filtros etiquetados, estados en español, vista en URL, limpieza completa y enlace directo a organización.

## Límite pendiente del backend existente
La ruta PATCH de suscripciones no comprueba todos los errores de las escrituras auxiliares de publicación en organizations/website_settings. Una actualización de suscripción y publicación conjunta podría quedar parcialmente aplicada. No se cambió ese contrato financiero en esta mejora de interfaz; requiere una corrección transaccional y pruebas específicas. Se omiten flags de publicación no modificados para evitar escrituras innecesarias.

## Evidencia
51 tests de suscripciones y pago manual pasan; Chrome usa datos ficticios e intercepta todas las APIs. Sin acceso a Supabase remoto ni cobros reales. Sin migración ni publicación.
