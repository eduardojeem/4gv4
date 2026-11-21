# Publicar MiTiendaPy Mobile en Google Play

Paquete: `com.mitiendapy.app` · proyecto EAS `@jeeem/mitiendapy` · comandos desde `mobile/`.

## Lo que ya está listo en el repo

- `app.json`: nombre, ícono adaptativo, splash, `package` y permisos. Se bloquean `RECORD_AUDIO`, `WRITE_EXTERNAL_STORAGE` y `SYSTEM_ALERT_WINDOW`; quedan `CAMERA` (escáner y fotos), `READ_EXTERNAL_STORAGE` (galería en Android 12 o anterior), `USE_BIOMETRIC`/`USE_FINGERPRINT`, `INTERNET` y `VIBRATE`. No se pide `READ_MEDIA_IMAGES`, así que no hace falta la declaración de permisos de fotos y videos.
- `eas.json`: el perfil `production` genera un AAB firmado por EAS, con `autoIncrement` del versionCode (`appVersionSource: remote`). `submit.production` sube al track `internal` como borrador.
- Entorno EAS `production`: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SITE_URL`, `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` cargadas. La app rechaza al arrancar cualquier URL que no sea la productiva.

## Pasos

1. Verificar: `npm run check` (typecheck, lint y expo-doctor).
2. Compilar: `npx eas-cli@latest build --platform android --profile production`.
3. Primera vez solamente: en Play Console crear la app con el paquete `com.mitiendapy.app` y subir a mano el primer AAB (Google no acepta la primera subida por API). Play App Signing queda activado; la clave de subida es la que guarda EAS (`eas credentials`).
4. Para las siguientes: crear en Google Cloud una cuenta de servicio con acceso a la app en Play Console, y cargar su JSON en EAS (`eas credentials` → Android → Google Service Account). Después: `npm run submit:prod` (sube al track interno como borrador).
5. Promover en Play Console: interno → cerrado → producción. Las cuentas de desarrollador personales creadas desde noviembre de 2023 necesitan una prueba cerrada con al menos 12 testers durante 14 días antes de pedir producción.

## Ficha de Play Console

- Política de privacidad: `https://www.mitiendapy.com/saas/privacidad`. El texto vive en la base (`legal_documents`): en SuperAdmin → Contenido web → Legal, «Cargar texto base» trae la versión del código (`src/lib/legal/defaults.ts`), que cubre la app (cámara, fotos, huella o Face ID local, almacenamiento seguro, notificaciones), los proveedores, los plazos, el borrado y el contacto `soporte@mitiendapy.com`. El responsable figura como «MiTiendaPy»: tiene que coincidir con el nombre de desarrollador de la ficha de Play.
- Seguridad de los datos: tiene que coincidir con la política. Se recopilan nombre, correo, teléfono, fotos de productos, datos de compras y pagos (sin tarjeta), identificadores del dispositivo (token de notificaciones) y registros de la app (inicios de sesión). Cifrado en tránsito; se puede pedir el borrado; no se venden ni se usan para publicidad; la huella o Face ID no salen del dispositivo. Desde la versión con «Tiendas cerca mío» se declara también **Ubicación aproximada** (función de la app, opcional, no se guarda ni se comparte).
- Borrado de cuenta: la app crea cuentas y comercios (ingreso con Google, «Crear mi comercio»), así que el borrado tiene que estar dentro de la app: está en Perfil → Eliminar cuenta. URL para el formulario: `https://www.mitiendapy.com/saas/eliminar-cuenta`.
- Acceso para revisión: la app requiere login; cargar en "Acceso a la app" un usuario de demostración que no tenga datos reales.
- Recursos: ícono 512×512, gráfico destacado 1024×500 y al menos 2 capturas de teléfono.
