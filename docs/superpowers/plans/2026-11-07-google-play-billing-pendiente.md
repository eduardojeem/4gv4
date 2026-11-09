# Google Play Billing en la app móvil (pendiente)

Estado: **pendiente, sin implementar**. Se dejó para más adelante el 2026-11-07.

## Situación actual

- La pasarela de la web es Bancard vPOS (más Stripe y transferencia, opcionales).
- La app nativa (Android/iOS) no cobra: `PURCHASES_IN_APP = Platform.OS === 'web'` en
  `mobile/src/app/admin/subscriptions.tsx` oculta pagar, cambiar de plan y transferir.
- La pantalla pública de planes (`mobile/src/app/saas/planes.tsx`) muestra precios y su
  botón dice "Crear mi cuenta"; el registro no cobra.
- La app usa Expo 57 con `expo-dev-client` y EAS (`eas.json`), paquete `com.mitiendapy.app`.
  No tiene librería de compras.
- En el superadmin "Google Play Billing" figura como medio pendiente sin integración.

## Alcance propuesto (primera versión)

Solo Android y suscripción mensual. Rama aparte: `feat/google-play-billing`.

### App
1. Librería de compras dentro de la app (por ejemplo `react-native-iap`); requiere build nativo.
2. En Suscripción, botón "Suscribirme con Google Play" por plan pago, con el precio que informa Google.
3. Al comprar, enviar el token de compra al servidor; no activar nada desde la app.

### Servidor
4. `POST /api/subscriptions/google-play/verify`: verifica la compra con la API de Google Play
   (cuenta de servicio), la vincula con la organización y aplica el plan con
   `apply_paid_provider_subscription_payment` (proveedor `google_play`).
5. Webhook de notificaciones en tiempo real (Pub/Sub): renovación, cancelación, vencimiento y
   reembolso extienden o cortan el plan.
6. Migración: `google_play` como proveedor y control de pago, tabla de compras con su token.

### Panel
7. Control "Google Play" en los medios de pago de suscripciones del superadmin.
8. En la web, si la empresa paga por Google Play, mostrar que se gestiona desde Google Play
   para evitar pagos duplicados.

## Lo que tiene que configurar el dueño de la cuenta

- Perfil de pagos en Play Console, con cuenta bancaria.
- Un producto de suscripción por plan pago (por ejemplo `plan_pro_mensual`).
- Cuenta de servicio de Google Cloud con acceso a la API de Google Play (clave JSON en el servidor).
- Tema de Pub/Sub apuntado al webhook.
- Build subido a prueba interna y cuentas de prueba (no funciona en Expo Go).

## A tener en cuenta

- Google retiene alrededor del 15% de cada suscripción.
- El precio en Google Play puede diferir del de la web (conversión e impuestos de Google).
- Cambios de plan y bajas de quien paga por Google Play se hacen desde Google Play.
- iOS exige Apple In-App Purchase: integración aparte, se puede hacer después con la misma librería.
- El cobro real solo se puede probar con Play Console configurado y la app instalada desde prueba interna.
