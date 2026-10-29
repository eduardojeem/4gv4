# Entorno local DEV para MiTiendaPy Mobile

La aplicación móvil local usa una instancia Supabase aislada y la API Next.js local. Las configuraciones de producción (`.env.local` de Next, `mobile/.env` y los valores EAS de producción) permanecen separadas.

## Inicio

1. Abrí Docker Desktop.
2. Desde la raíz del proyecto, ejecutá `npm run supabase:mobile:start`. Este comando crea o inicia un proyecto Supabase con ID local propio, puertos 55321–55324 y una carpeta bajo `%LOCALAPPDATA%\MiTiendaPy\mobile-dev-supabase`. Copia únicamente las migraciones del repositorio y 01/04; no copia `.temp`, datos ni credenciales de producción. 02 y 03 no se copian. También crea (o ajusta) el bucket público `product-images` (5 MB, solo imágenes), que en producción no viene de una migración y que usan las subidas de logo y banners del sitio web; no agrega políticas de Storage. Si falta, crea la fila global de `system_settings` (base de Configuración en la web y en la app); si ya existe no la modifica.
3. El comando genera `.env.development.local` y `mobile/.env.local`, ambos ignorados por Git. La clave service role local queda solamente en el archivo del servidor; Expo recibe únicamente la publishable key local.
4. Ejecutá `npm run dev`. El wrapper valida que Next apunte por HTTP a Supabase local; si falta la configuración o detecta una URL cloud, se niega a iniciar. Next escucha en `0.0.0.0:3000` para la LAN.
5. En otra terminal, desde `mobile/`, ejecutá `npx expo start --lan --port 8083`. Reiniciá Expo después de cambiar la IP o el entorno.
6. Ejecutá primero `npm run mobile:dev:seed -- --dry-run` para revisar destino, schema/RLS y colisiones sin escribir. Si el precheck pasa, `npm run mobile:dev:seed` carga fixtures sintéticos; el seed es idempotente y solo reconcilia IDs DEV determinísticos. No ejecuta migraciones ni elimina filas ajenas al dataset.

El seed usa únicamente `@dev.example.test`, una organización sintética local, dos sucursales, cuentas de administrador/vendedor/técnico, asignaciones usuario-sucursal, 30 productos, 12 variantes, inventario en ambas sucursales, 10 clientes, 10 reparaciones, 12 ventas con 24 líneas y dos cajas/sesiones históricas cerradas. En el Supabase local, la vitrina pública queda habilitada solo para pruebas: 24 productos simples con stock son `public`; los 6 productos con variantes siguen `hidden`. No crea una caja abierta. La contraseña de prueba queda solo en `.env.development.local`; no se imprime ni se envía a Supabase cloud. Los productos tienen costos conocidos, un costo legítimo igual a cero y un costo desconocido `NULL`; no cambia ACL/RLS. Las asignaciones de sucursal se reconcilian evitando el `UPSERT` que chocaba con el trigger de sucursal primaria.

Para regenerar las variables cuando cambie la IP, ejecutá `npm run mobile:dev:env`; se vuelve a detectar una IPv4 LAN `192.168.x.x` o `10.x.x.x`. Si hay varias interfaces, podés indicar `DEV_LAN_IP` con la IP de la interfaz conectada al teléfono.

`npm run supabase:mobile:stop` detiene solo el proyecto local aislado y conserva sus datos. No uses `supabase db reset` si querés conservar los fixtures de prueba.

## EAS

- `development` utiliza el entorno EAS `development` y no incluye valores cloud en `eas.json`. Para builds EAS futuras, ese entorno debe tener `EXPO_PUBLIC_RUNTIME_ENV=development`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con la IP LAN y credenciales locales vigentes. No se creó ni modificó ninguna variable remota y no se hizo ningún build.
- `preview` usa el entorno EAS `preview`, sin copiar las URLs de producción. La app rechaza valores de preview vacíos o apuntados a producción hasta que se configure un backend de pruebas independiente.
- `production` toma las URLs y la publishable key de producción del entorno EAS `production` (no de `eas.json`). No contiene service role. Para publicar en Google Play, ver `docs/mobile-android-release.md`.

Las variables `EXPO_PUBLIC_*` se incluyen en el bundle; solo deben contener datos públicos. Nunca agregar `service_role` a Expo.

## Alcance de pruebas

El smoke script imprime solamente endpoint, estado HTTP, presencia de sesión/organización/sucursal y cantidad de registros. Sin `--allow-local-writes`, el login crea solo una sesión Auth local y la apertura de caja queda omitida; las consultas de negocio son GET. `--allow-local-writes` permite abrir una caja sintética local y debe reservarse para una prueba deliberada. Las pruebas HTTP a la IP LAN desde la propia PC no sustituyen una verificación de escaneo y login desde un teléfono físico; la ruta de dispositivo depende también de que el teléfono esté en la misma red y el firewall permita Metro.
