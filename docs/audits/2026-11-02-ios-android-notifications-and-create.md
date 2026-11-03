# iOS / Android notifications and contextual Create — local audit

Scope: source inspection and mocked tests. No push sent, no production writes, no APNs/FCM credentials inspected, no physical device connected. Existing localhost:3000 + Expo:8081 use real data when a user saves manually.

## Findings (notification changes not applied)

- P1: booking event types exist (src/lib/notifications/types.ts:457 and server/content.ts:140), but searching src, scripts and supabase finds no emitters for BOOKING_CREATED or BOOKING_REMINDER outside catalog/templates. The agenda POST/PATCH must be traced and connected before promising barber/service notifications. External scheduling infrastructure was not verified.
- P1: src/lib/notifications/server/dispatcher.ts:96 catches module-resolution failure and continues delivering. Business/module eligibility therefore fails open if plan lookup fails. planInfo.modules currently aliases effectiveModules (subscription-service.ts:774), so using modules itself is not a mismatch.
- P2: src/lib/notifications/server/preferences.ts:150 returns every NOTIFICATION_TYPE; mobile settings renders all categories without filtering permitted business modules. A service business sees repair/stock switches irrespective of relevance. Actual recipient selection does filter members, permissions and branches; dispatcher filters enabled modules when lookup succeeds. Recommended: derive visible categories from effective modules plus role permissions, preserve security/account notices, use rubro for ordering/default wording rather than hiding an actually enabled module.
- P2: mobile/src/lib/push-notifications.ts:60 treats only granted status as enabled; iOS provisional authorization should be handled explicitly. Registration lacks an Expo Go capability guard. Android remote push cannot be tested in Expo Go SDK 57 (official Expo SDK 57 Notifications docs); use a development build and validate APNs/FCM credentials separately.
- P2: src/lib/notifications/server/expo-push.ts:142 counts absent tickets as delivered, and accepted tickets as delivery. No push receipt polling was found in the notification sender. Acceptance by Expo does not prove delivery on iOS/Android. Distinguish accepted, failed and confirmed receipts, including DeviceNotRegistered discovered in receipts.
- P2: dispatcher.ts:237 payload omits badge. Client badge refresh happens when the app is active (notifications-context.tsx:29,64); an iOS closed/background app can retain an old badge. Server unread-count badges need a deliberate implementation.
- P2: foreground handler in push-notifications.ts:180 unconditionally requests sound/banner/list and has no contextual presentation policy. Android creates every category channel, even categories irrelevant to the active business. Category channels and explicit user sound settings should not be treated as verified by source checks.

Positive evidence: Android channels are created before requesting permission; payload includes organizationId; tapping a notification from another organization goes to the inbox; recipients are filtered by membership, permission and branch; app and push preference channels are separate; notification routes use a controlled resolver.

## Applied menu changes

Central + is consistently labelled Crear and always opens a chooser. Up to two eligible actions, prioritizing the business focus and then new order. Workshop: repair/order; services: reservation/order; retail: sale/order where modules and permissions permit. No artificial second action for users lacking permission. Right-hand Más still opens the sections menu.

New order uses the existing web form via an explicitly labelled mobile handoff screen. NewOrderEntry prevents opening it for another active browser organization. Native order entry was not implemented and financial/stock logic was not duplicated. Backend permissions remain authoritative.

## Verification

Navigation and sections models: 15 tests passed. Pending final type/lint and notification regression results are reported in the chat. Physical iOS/Android delivery, locked-screen sound/badge, background/cold start and APNs/FCM remain unverified.

Official reference: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
