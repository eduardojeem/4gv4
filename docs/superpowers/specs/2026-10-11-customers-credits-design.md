# Clientes y Créditos: cobros confiables y presentación clara

## Objetivo y alcance aprobado

Corregir los flujos existentes de Clientes y Créditos sin cambiar precios, planes,
permisos comerciales ni decisiones de crédito de clientes reales. La aplicación debe
mostrar cifras verificadas y diferenciar deuda, mora, cupo y saldo a favor.
Este documento requiere revisión del usuario antes del plan y la implementación.

## 1. Cobro transaccional e idempotente

Los cobros de una cuota, varias cuotas y deudas mixtas de un cliente usarán una
operación de servidor respaldada por una única transacción PostgreSQL por solicitud.
Se conservarán los endpoints existentes, eliminando los bucles de escrituras HTTP
del navegador y el reparto de escrituras independientes del servidor.

- Validar sesión, organización, permiso, módulo y sucursal antes de la operación.
- El servidor proporciona el actor autenticado; el navegador no decide su identidad.
- La función privilegiada nueva será ejecutable solamente por service_role y volverá
  a comprobar pertenencia, permisos del actor y acceso a sucursal.
- Bloquear deudas y caja en orden estable. Releer saldos bajo bloqueo antes de repartir.
- Si una deuda seleccionada cambia y el reparto solicitado ya no cabe, rechazar toda
  la operación sin cobros parciales y pedir revisar el reparto actualizado.
- Guardar pagos, cambios de estado, movimientos de caja y excedente confirmado dentro
  de la misma transacción. Reutilizar las reglas financieras de reparaciones y cuotas;
  no llamar funciones dependientes de auth.uid() como si fueran compatibles con actor explícito.
- El excedente solo irá a saldo a favor con confirmación explícita. Efectivo requiere
  caja abierta; transferencias y tarjetas conservan sus referencias y no suman efectivo.
- Clave de idempotencia por organización y solicitud, con restricción única y huella
  del contenido. Mismo contenido devuelve el resultado persistido; contenido distinto
  con la misma clave devuelve conflicto. Un fallo revierte también el registro incompleto.
- Conservar la clave en un reintento de resultado incierto. Impedir cambiar el contenido
  de ese intento hasta resolverlo; un nuevo cobro confirmado tendrá una clave nueva.
- El resultado persistido incluye identificador de recibo, monto aplicado, excedente,
  reparto y saldos posteriores. Recibos y confirmaciones usan ese resultado, no proyecciones.
- Puntos de fidelidad permanecen secundarios: su fallo no revierte el cobro; su
  acreditación/reintento debe deduplicarse por identificador de pago persistido.

Las funciones antiguas no se eliminarán sin inventariar consumidores. Las pantallas
modificadas no recurrirán al flujo inseguro si falta la migración: mostrarán un aviso.

## 2. Lecturas y cifras completas

- Totales globales se calculan en servidor sobre todo el conjunto autorizado, no
  sobre las primeras 1.000 cuotas ni los últimos 200/300 pagos.
- Separar resumen global, resumen del filtro y filas paginadas. Las exportaciones
  deberán identificar su alcance y no presentar una muestra como cartera completa.
- Clientes distintos se cuentan por customer_id, nunca por nombre.
- Respetar estados anulados/completados y las reglas actuales de deuda de reparaciones;
  definir explícitamente el universo de cada cifra en etiquetas y pruebas.
- Un fallo en la deuda consolidada invalida deuda, cupo y riesgo: mostrar error con
  reintento, nunca sustituir por cero, datos de otro cliente o cupo completo.
- Evitar respuestas antiguas al cambiar cliente u organización. No tratar ausencia
  de esquema o módulo como una cartera vacía válida.

## 3. Fechas y evaluación

Fecha de vencimiento es una fecha de calendario, no medianoche UTC. Comparar pagos
por día calendario de la organización, usando su zona configurada y el valor
existente por defecto cuando no la tenga. Un pago el día del vencimiento es a tiempo.
Las deudas sin fecha mostrarán «Sin vencimiento definido», sin inventar hoy.

La evaluación calculada es orientativa, separada de la decisión documental guardada.
Eliminar «Confiable», «Restringir» y «Bloqueado» como afirmaciones automáticas.
Sin historial suficiente mostrar «Sin historial suficiente», no 100/100 como mérito.
No implementar nuevas reglas de aprobación automática ni modificar decisiones existentes.

## 4. Diseño y búsqueda

Clientes conserva directorio, ficha y configuración global separada. La ficha presenta
identidad (nombre, código, documento) y cuatro conceptos visibles: deuda total, deuda
vencida, cupo disponible y saldo a favor. Acciones principales: Cobrar, Editar datos y
Ficha para crédito. El saldo a favor no se resta de la deuda sin una operación explícita.

Créditos prioriza Vencidas, Vencen hoy y Próximas, manteniendo acceso al historial.
Cada crédito muestra cliente, origen, saldo y próxima cuota. Distinguir encabezado
global del resultado filtrado. Los modales comparten contrato de resultado y mensajes,
con resumen del reparto antes de confirmar y comprobante real al terminar.

Móvil: contenido desplazable, acciones accesibles, entradas de tamaño legible,
espacio para teclado y textos que no dependan solo del color. Preservar borradores.
El historial de búsqueda se separará por organización y usuario, validando su formato;
no se reutilizará el historial global anterior. Alinear ayudas de búsqueda con campos
que realmente consulta el servidor y conservar clientes homónimos distinguibles.

## 5. Verificación y entrega

Pruebas de regresión antes de cada corrección: errores de carga, cambios de cliente,
homónimos, fechas límite, sin historial, recibo por monto aplicado y cartera grande.
Pruebas de base local: rollback por fallo intermedio, cobros concurrentes, reintento
idéntico, clave reutilizada con otro contenido, aislamiento de organización, permisos,
caja cerrada y excedente. Los mocks no sustituyen estas pruebas transaccionales.

Ejecutar pruebas focalizadas, TypeScript, lint y diff-check; validar diseño autenticado
a 320, 768, 1024 y 1440 px cuando haya sesión disponible. Declarar cualquier bloqueo.
No hacer cobros ni subir documentos privados reales para probar.

Crear SQL con la CLI de migraciones y entregar rutas exactas e instrucciones de orden.
No aplicar SQL remoto, reparar historial, publicar ni mezclar ramas en este alcance.
Para la entrega posterior: aplicar migración aditiva antes del código que la exige;
un retroceso de código conservará pagos y recibos ya registrados.
