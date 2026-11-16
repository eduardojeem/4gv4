# Mis turnos en la app

Alcance autorizado: acceso desde perfil/Mi cuenta/menú rápido; próximos e historial paginados, detalle privado y enlace de gestión existente. Ver solo reservas de fichas cuyo profile_id coincide con el usuario autenticado; no asociar por nombre, teléfono, sucursal activa ni IDs enviados por el cliente.

- API autenticada personal, sin exigir pertenecer a una empresa, con fechas/moneda de cada tienda y precio visible según la política existente.
- Pantallas nativas protegidas, reintento y paginación, recarga al volver al foco, limpieza por cambio de sesión.
- Reutilizar el sitio de la tienda para reprogramar/cancelar; el servidor existente valida disponibilidad y condiciones. No crear una segunda regla de reservas.
- Preparar un índice por cliente/fecha/ID. No aplicarlo ni tocar producción. La funcionalidad opera sin ese índice; mejora el acceso a historiales grandes.
- Verificar privacidad, datos incompletos, navegación, tipos/lint y UI con fixtures. Sin push ni deploy.