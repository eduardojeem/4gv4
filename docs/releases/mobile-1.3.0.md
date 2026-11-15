# Mi TiendaPy — app 1.3.0

## Notas para Play Store (es-419, máx. 500 caracteres)

Novedades:
• Promociones desde el celular: descuentos, puntos de fidelidad, sorteos y clientes del programa.
• Fidelidad por visitas para barberías y servicios.
• Agenda, clientes y reparaciones con pantallas mejoradas.
• Créditos, caja y finanzas más claros y con datos siempre actualizados.
• Sitio web y apariencia de la tienda desde la app.
• Correcciones y mejoras de velocidad.

## Antes de compilar

1. Unir el PR de fidelización (#115) y correr en producción la migración
   `20261115161607_loyalty_service_program.sql`: sin ella, el panel de
   Promociones no puede leer el programa de visitas.
2. Opcional: `npx expo install --check` dentro de `mobile/` para alinear 5
   paquetes con un parche menor pendiente (expo-router, expo-sharing,
   expo-constants, expo-linking y otro). No bloquea la compilación.

## Compilar y enviar (desde `mobile/`)

```bash
npx eas-cli@latest build --platform android --profile production
```

```bash
npx eas-cli@latest submit --platform android --profile production --latest
```

- `appVersionSource: remote` + `autoIncrement`: EAS sube solo el número de
  compilación (versionCode). La versión visible es `1.3.0` (app.json).
- El envío va a la pista **interna** como **borrador** (eas.json): queda
  para revisar y publicar a mano desde Play Console.
- No hay actualizaciones por aire (expo-updates no está instalado): cada
  cambio de la app necesita una compilación nueva.

## Verificado

- `tsc --noEmit` de la app: limpio.
- `expo lint`: sin errores (2 avisos de variables sin uso).
- Sin dependencias nativas nuevas desde la 1.2.2: no cambia `package.json`
  ni la configuración de Expo.
