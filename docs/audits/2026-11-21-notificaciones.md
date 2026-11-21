# Auditoría de notificaciones (web y app) y plan de mejora

Fecha: 21/11/2026 · Base: `main` en `d79186b5` (con #163). Corregida tras implementar la Fase 0.

## ¿Las notificaciones se diferencian por rubro?

**En parte.**

- **El envío sí respeta el rubro.** El dispatcher filtra por `planInfo.modules`, que son los **módulos efectivos** del comercio (`buildOrganizationBusinessProfile`: plan, rubro y lo que el comercio activó). Un comercio sin taller no recibe avisos de reparaciones. *(La primera versión de esta auditoría decía lo contrario: era un error.)*
- **Las preferencias no lo respetaban:** devolvían los **46 tipos a todos los usuarios**, sin mirar permiso, módulo ni si el aviso se envía. Una barbería veía interruptores de Reparaciones y Stock. **Corregido en la Fase 0** (ver abajo).
- Los **textos** son genéricos («orden de reparación», «turno»), sin vocabulario por rubro.

Lo que sí filtra bien: la **sucursal** (asignaciones activas), el **permiso del rol** (`requiredPermission`) y que **quien hace el cambio no reciba su propio aviso**, salvo dueños y administradores.

## Qué se envía de verdad

De **46 tipos definidos**, se envían **15** (incluidos los 2 del #163).

| Área | Se envía | Definido pero nunca se envía |
|---|---|---|
| Ventas | Venta registrada, Venta grande | Venta anulada, Devolución |
| Pedidos | Pedido nuevo, Pedido online, Confirmado, Listo, Cancelado | Pedido demorado |
| Reparaciones | Nueva, Asignada · *con #163: Lista, Entregada* | Cambio de estado, Demorada, Nota agregada |
| **Turnos / Agenda** | — | **Los 6: nueva, confirmada, cancelada, reprogramada, recordatorio, no se presentó** |
| **Stock** | — | **Stock bajo, Agotado, Variante con stock bajo, Ajuste** |
| Caja | — | Apertura, Cierre, **Diferencia de caja** |
| Créditos y cobros | — | Cuota por vencer, **Cuota vencida**, Pago recibido, Pago fallido |
| Compras | — | Orden recibida, demorada, cambio de estado |
| Equipo y seguridad | — | Invitación, Cambio de rol o permisos, **Nuevo inicio de sesión**, Cambio de contraseña |
| Suscripción | Por vencer, Pago fallido, Cambio de plan | — |
| Sistema | Novedades | Mensaje importante |

Lo que más falta, por rubro:

- **Servicios, barberías y belleza:** ningún aviso de turnos. Una reserva online entra sin que nadie se entere en el celular.
- **Comercios con inventario:** ningún aviso de stock bajo o agotado.
- **Todos:** ningún aviso de dinero (diferencia de caja, cuotas vencidas) ni de seguridad (inicio de sesión nuevo).

## Cómo se reciben

**App móvil (bien resuelto)**
- Bandeja de avisos (`panel/notifications`), contador de no leídos, avisos de la plataforma y marcar como leído.
- Preferencias por tipo, con push y bandeja por separado (`panel/settings/notifications`).
- Canales de Android por categoría, con prioridad alta en pedidos, reparaciones, caja y créditos.
- Al tocar un aviso se abre la pantalla correspondiente (`routes.ts`).
- Expo Go no recibe push en Android desde SDK 53: para probar hace falta la app de Play o un build de desarrollo.

**Panel web (falta)**
- **No hay bandeja.** La campana del panel (`components/ui/notification-bell.tsx`) usa `useOptimizedNotifications`, un sistema local de acciones pendientes del navegador; nadie en la web consulta `/api/notifications`. Un administrador que trabaja solo en la PC nunca ve los avisos.
- No hay página de preferencias en la web (la API existe: `/api/notifications/preferences`).
- No hay push del navegador.

**Otros problemas**
- Las preferencias mostraban interruptores de 31 avisos que nunca se envían (corregido en la Fase 0).
- Varios tipos no tienen texto con datos (por ejemplo «Cambio de estado en reparación» no dice qué equipo ni a qué estado pasó).
- Los canales `email`, `sms` y `whatsapp` están en el tipo `NotificationChannel`, pero no hay envío al personal por esos medios.

## Plan de mejora

### Fase 0 — Ordenar lo que hay ✅ hecha

1. ✅ Mergeado el **#163** (Reparación lista y entregada).
2. ✅ El envío ya filtraba por módulos efectivos (rubro): se aclaró el comentario del dispatcher.
3. ✅ **Preferencias solo con lo que aplica** (`src/lib/notifications/visibility.ts`): un tipo se muestra si **se envía** (`IMPLEMENTED_NOTIFICATION_TYPES` en `types.ts`), el rol tiene el permiso y el módulo efectivo está activo.
4. ✅ **Test de contrato** (`src/test/notification-preferences-visibility.test.ts`): la lista de implementados coincide con los puntos de envío del código, en las dos direcciones. Al sumar un aviso nuevo hay que agregarlo a la lista, o el test falla.

### Fase 1 — Lo que cada rubro necesita · 🟡 en curso

Hecho (PR «avisos de turnos y stock»):

- ✅ **Turnos:** nuevo, reprogramado y cancelado cuando lo hace el **cliente** desde la web (reserva online o enlace del turno), con el mismo texto de la campanita de la Agenda. Se envía aunque la tienda no quiera email.
- ✅ **Stock bajo y agotado** después de cada venta del POS: mira el inventario y el mínimo de la sucursal (o los del producto). Como máximo un aviso por día, por producto y sucursal. Agotado sale con push; stock bajo, solo en la bandeja (se puede activar el push en preferencias).
- ✅ **Vocabulario por rubro:** en barberías y belleza, «Nuevo turno», «Turno cancelado» y «Turno reprogramado»; en el resto, «reserva».

Pendiente de la Fase 1: recordatorio del día de turnos, stock al confirmar pedidos, reparación demorada y nota agregada.

Plan original:

| Rubro | Avisos | Dónde se disparan |
|---|---|---|
| Servicios, barbería, belleza | Turno nuevo (sobre todo reservas online), cancelado, reprogramado | RPC/rutas de Agenda (`agenda_booking_atomic` y la reserva pública) |
| Servicios, barbería, belleza | Recordatorio del día (resumen a la mañana) | Tarea diaria (cron) |
| Comercios con inventario | Stock bajo y agotado | Al vender (`process-sale`), al ajustar stock y al confirmar pedidos; como máximo una vez por día y por producto |
| Taller | Reparación demorada (vencida la fecha prometida) | Tarea diaria |
| Taller | Nota agregada (al técnico asignado) | Ruta de notas de reparación |

Con esto, además, **los textos usan el vocabulario del rubro** («turno» o «cita», «orden de servicio» o «reparación»), tomando `businessVertical` del comercio.

### Fase 2 — Dinero y seguridad (1 semana)

- **Diferencia de caja** al cerrar con faltante o sobrante (a dueños y administradores).
- **Cuotas vencidas** (créditos): un **resumen diario** en lugar de un push por cuota.
- **Pago fallido** (Bancard o Stripe) y **venta anulada** o **devolución** (a dueños).
- **Nuevo inicio de sesión** y **cambio de contraseña** (aviso personal, sin opción de apagarlo).

### Fase 3 — Panel web (1 semana)

1. **Bandeja en la campana del panel:** lista paginada desde `/api/notifications`, contador de no leídos (`/unread-count`), marcar como leído y abrir el recurso.
2. Separar la campana actual (acciones pendientes del navegador) de los avisos del servidor.
3. **Página de preferencias** en la web, igual que en la app y con el mismo filtro de la Fase 0.
4. Opcional: **push del navegador** (Web Push), solo para avisos urgentes (pedido online, diferencia de caja).

### Fase 4 — Calidad (continuo)

- **Agrupar** ráfagas: muchas ventas seguidas se resumen en «12 ventas en la última hora» en vez de 12 push.
- **Horario silencioso** por usuario (por ejemplo, de 22 a 7), salvo seguridad.
- **Limpiar dispositivos** cuyo token Expo responde `DeviceNotRegistered`.
- **Métricas** de entrega (intentados, entregados, fallidos por tipo) en el panel del superadmin.

## Orden sugerido

Fase 0 → turnos y stock de la Fase 1 (son los rubros que hoy no reciben nada) → bandeja web de la Fase 3 → el resto.
