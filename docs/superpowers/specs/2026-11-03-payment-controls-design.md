# Control de medios de pago

Estado: aprobado por el usuario e implementado localmente. La migración de protección ya está en main (PR #75) y el usuario confirmó su aplicación en producción; no se modifica ni se vuelve a aplicar en esta entrega. Alcance confirmado: suscripciones y cobros de comercios, en secciones separadas.

## Resultado visible

1. **Superadmin → Facturación → Medios de pago**: catálogo de medios para pagar los planes de MiTiendaPy. Solo superadministradores pueden modificarlo.
2. **Admin → Facturación → Medios de cobro**: catálogo operativo del comercio activo. Cada administrador autorizado puede modificar únicamente su organización. Agregar acceso desde la navegación existente, sin confundirlo con el pago de su propia suscripción.

Pantallas web responsive, utilizables desde el navegador móvil. Las aplicaciones móviles deben consumir las mismas políticas: deshabilitar un medio debe impedir nuevas operaciones también desde la app. Agregar pantallas nativas de configuración no forma parte de esta primera entrega.

Cada tarjeta mostrará nombre, para qué sirve, canales donde aplica y estado efectivo: habilitado, deshabilitado, sin configurar o integración pendiente. Interruptor accesible, confirmación de guardado, bloqueo mientras se guarda, manejo de error y reintento. No mostrar claves o credenciales. Usar el tema existente.

## Enfoque

Se propone una política central consultada por interfaz y servidor, con claves independientes por medio. Un interruptor meramente visual permitiría seguir usando la API; cambiar variables de entorno exigiría despliegues y no permitiría configurar cada comercio. La política central permite cambios persistentes y validación común.

Deshabilitar bloquea **operaciones nuevas**. No borra historial, no cancela planes adquiridos, no cambia saldos ni cupos, y no bloquea confirmaciones de pagos iniciados, devoluciones, cancelaciones, conciliación o consulta de comprobantes. Ningún control habilita permisos o módulos que el comercio no tenga.

## Suscripciones

- Pagopar tarjeta y QR, con controles independientes.
- Stripe: control sujeto a credenciales y habilitación técnica ya existentes.
- Transferencia: reutilizar su configuración y validación existentes; una sola fuente de verdad para enabled y la cuenta receptora.
- Pagopar débito automático: distinguir habilitación de nuevas adhesiones de la ejecución de cobros ya consentidos. El interruptor de esta entrega controla nuevas adhesiones; indicarlo explícitamente. Detener débitos ya pactados requiere una acción separada y no está incluido.
- Códigos de activación/promoción: mostrar como mecanismo de activación separado del dinero. Si se permite pausarlos, afecta nuevos canjes, nunca beneficios ya aplicados.

No presentar Apple IAP o Google Play Billing como implementados. Las menciones históricas a Mercado Pago no prueban una integración actual. PayPal tiene simulaciones en `src/lib/integrations/payment-processors.ts`; otros nombres solo aparecen en tipos. Pueden figurar informativamente como pendientes, sin interruptor operativo. No instalar ni integrar nuevas pasarelas.

## Comercio

Inventariar los consumidores reales antes de asignar controles: efectivo, tarjeta, transferencia, QR/billetera, venta a crédito y saldo a favor, cuando cada flujo los soporte.

El comercio tendrá medios comunes con indicación de disponibilidad por canal: POS, reparaciones, tienda web y otros cobros existentes. No inventar disponibilidad: billetera digital web no implica una pasarela integrada ni un medio válido en reparación.

Reutilizar y sincronizar `checkout.payment` de la tienda para evitar interruptores contradictorios. El nuevo control será la habilitación general del medio para el comercio; la configuración de checkout podrá restringirlo adicionalmente. La pantalla debe explicar esa relación y enlazar al checkout cuando corresponda.

Los permisos, plan, módulo, caja requerida y reglas de financiación continúan aplicando. Bloquear nuevas financiaciones cuando crédito está apagado, pero permitir cobrar cuotas de créditos existentes usando un medio permitido. No bloquear cierre de caja, devoluciones o reversos. Validar cada componente de pagos mixtos, no solo su etiqueta. El tratamiento de canjes de saldo a favor debe conservar las reglas transaccionales existentes.

Puede deshabilitarse el último medio: mostrar advertencia clara y un estado sin métodos disponibles; nunca elegir automáticamente uno deshabilitado. No cambiar valores vigentes por defecto durante la integración.

## Persistencia y límites

Preferir reutilizar almacenamiento de configuración existente si permite autorización e independencia entre organizaciones y actualizaciones sin pisar otras claves. En caso de necesitar una tabla/RPC, preparar migración local revisable; no aplicarla al proyecto remoto sin autorización. La lectura debe distinguir política ausente (valores de compatibilidad) de error del almacenamiento (no aparentar un catálogo disponible).

Aplicar escritura parcial/atómica o control de versión para evitar pérdida de cambios concurrentes. Validar claves conocidas y booleanos; resolver el comercio desde la sesión autorizada, no confiar en un organizationId del navegador. Registrar actor, alcance y cambios sin datos sensibles. No usar caché que permita seguir iniciando pagos con una configuración desactualizada.

## Entrega y pruebas

Implementar primero política/contrato, luego Superadmin y consumidores de suscripciones, luego comercio y consumidores operativos. Usar pruebas locales con dobles de proveedores, sin pagos o escrituras en datos reales.

Cubrir: no autenticado, permisos insuficientes, aislamiento entre organizaciones, claves inválidas, concurrencia, apagado por API directa, pagos mixtos, política no disponible, métodos sin credenciales, navegación web/móvil, pagos ya iniciados y conservación del historial. Ejecutar tsc raíz y mobile, ESLint de archivos modificados, pruebas enfocadas y diff check. Verificación visual con datos simulados o lectura autenticada autorizada; no probar interruptores sobre producción.

La extracción del 2026-11-05 autoriza un commit local en `feat/controles-de-pago`. Sin push, merge, deploy ni cambios remotos en Supabase. Informar explícitamente cualquier migración pendiente y cualquier consumidor no cubierto; no presentar controles parciales como efectivos en todo el sistema.

## Decisiones dejadas al implementador

Nombres internos, componentes reutilizables, rutas concretas dentro de los grupos indicados, localización exacta de los controles de servidor y estrategia de pruebas. Conservar compatibilidad con las variantes heredadas de nombres de medios y la distinción entre procesar un pago y registrar uno realizado fuera del sistema.
