# Controles del cobro móvil de cuotas

Estado: implementación parcial local, sin commit/push/deploy ni cambios de base.

## Implementado
- CollectSheet consulta los medios habilitados. Un intento pendiente conserva su recuperación idempotente aun si cambia la configuración de medios.
- Vista previa: aplicado, deuda seleccionada restante, deuda total restante, exceso y efecto sobre el efectivo del cajón. Tarjeta/transferencia no afirman acreditación bancaria.
- Prevalidación de caja con permisos CRM y cliente/organización/sucursal verificados. Se vuelve a consultar antes de un cobro nuevo, sin reemplazar el control transaccional del RPC.
- Caja móvil muestra cuotas por método en comprobantes unificados de las últimas 24 horas, con alcance explícito. No modifica el saldo de caja ni los totales de ventas. No cubre circuitos históricos sin comprobante unificado.
- Si se supera el límite de 1000 comprobantes, falla explícitamente en lugar de presentar un subtotal como total.

## Pendiente
- Conciliación persistente con responsable, referencia y estados.
- Anulación auditada con permisos/motivo y reversión transaccional de deuda, caja, saldo a favor y fidelidad. Los cobros consolidados pueden mezclar cuotas, reparaciones y exceso: no es seguro borrar una fila ni modificar solo amount_paid.
- No se creó ni aplicó una migración nueva para esas dos funcionalidades. La migración anterior de finance-control no corresponde a esta tarea.
- Docker está instalado pero su daemon no está disponible (docker ps falla también fuera del sandbox, pipe dockerDesktopLinuxEngine inexistente). Hace falta una base local operativa para verificar las transacciones contables.
- No se verificó en dispositivo físico.

## Verificación observada
- 7 archivos de pruebas / 46 pruebas aprobadas: contexto de caja, resumen por método/API, vista previa, integridad/adaptador móvil y recuperación idempotente.
- TypeScript raíz y mobile sin errores.
- ESLint de archivos nuevos/modificados sin errores; git diff --check sin errores.
