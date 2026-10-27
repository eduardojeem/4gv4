# Regional settings — plan de implementación Fase 1

Fecha: 2026-10-25
Diseño: `docs/superpowers/specs/2026-10-25-regional-settings-design.md`

## Alcance y exclusiones

Implementar el contrato TypeScript puro y compartir el catálogo regional entre Next.js y Expo. No crear migraciones, no tocar onboarding/API/Supabase, no modificar la taxonomía actual ni arreglar los hallazgos públicos independientes. Preservar organizaciones legacy y sus defaults existentes.

## Mapa de archivos

Crear:
- `src/lib/regional/contract.ts`: tipos CountryCode, CurrencyCode, LocaleCode, RegionalSettings, regional defaults, normalizadores y formatter explícito.
- `src/lib/regional/contract.test.ts`: matriz de contrato, defaults e invariantes de formato.
- `docs/superpowers/specs/2026-10-25-regional-settings-design.md`: decisiones y diccionario.
- `docs/superpowers/plans/2026-10-25-regional-settings-implementation.md`: este plan.

Modificar:
- `src/lib/currency.ts`: delegar catálogo y formato explícito al contrato común, conservando exports y fallbacks existentes.
- `mobile/src/lib/settings-model.ts`: derivar la lista de monedas/símbolos del catálogo común y mantener compatibilidad de OrgSettings y nombres usados por pantallas.
- `mobile/src/lib/marketplace.ts`: conservar `formatGs` como compatibilidad PYG, delegando al formatter común con `PYG` y `es-PY`; no cambiar DTOs ni pantallas consumidoras.
- `mobile/metro.config.js`: agregar solo `src/lib/regional` a `watchFolders` para permitir el import compartido comprobado por Metro.

No modificar archivos locales ajenos o los 24 archivos modificados/19 archivos untracked existentes.

## Secuencia TDD

### Tarea 1 — Contrato regional puro

- Red: crear primero `src/lib/regional/contract.test.ts` con pruebas para `py`/`PY`, entradas de país mal formadas, `pyg`/`BRL` y moneda inválida, defaults PY/BR/AR/US, timezone US requerido, zona IANA válida/inválida, locale independiente de moneda y formatter PYG sin fracción frente a BRL/USD con decimales.
- Verificar que las pruebas fallan inicialmente porque el módulo/export no existe.
- Green: implementar el mínimo catálogo/tipos/normalizadores/default resolver/formatter en `src/lib/regional/contract.ts`.
- Refactor: revisar API pública pequeña y que códigos de países no configurados no produzcan defaults inferidos.

Interfaz producida: tipos y funciones regionales compartidas. Consumidores: Web, Mobile y pruebas.

### Tarea 2 — Web adapter compatible

- Mantener pruebas actuales `src/test/currency.test.ts` sin cambios de expectativa pública.
- Modificar `src/lib/currency.ts` para derivar las definiciones de catálogo del módulo regional y que `formatCurrency` use `currency + locale` explícitos al delegar.
- Ejecutar `node_modules/.bin/vitest run src/test/currency.test.ts src/lib/regional/contract.test.ts`.

Interfaz consumida: `SUPPORTED_CURRENCIES`, `SupportedCurrencyCode`, fraction digits y formatter común. Compatibilidad: mismos exports y defaults PYG/es-PY.

### Tarea 3 — Mobile adapter compartido

- Importar el catálogo y el formatter desde el módulo puro root-relative `../../../src/lib/regional/contract` (o ruta equivalente comprobada desde `mobile/src/lib`). Configurar un `watchFolder` Metro exclusivo para `src/lib/regional`, basado en la exportación SDK 57 que demostró ser necesaria.
- Derivar `CURRENCIES` y `currencySymbol` de la fuente común sin cambiar forma de los exports.
- Delegar `formatGs` al formatter común con PYG/es-PY y conservar su responsabilidad explícita como formatter PYG legacy.
- Agregar una prueba de compatibilidad que compare el catálogo consumido por settings móviles y el contrato canónico, sin depender de React Native.
- Ejecutar TypeScript Mobile y Web; realizar Expo web export o bundle si el runtime instalado lo permite.

Interfaz consumida: `CurrencyCode`, catálogo, `getCurrencySymbol` y formatter. Fuera de alcance: trasladar todas las pantallas/DTOs a moneda dinámica.

### Tarea 4 — Validación y revisión de alcance

- Tests regionales y de moneda existentes.
- TypeScript Web (`npm run typecheck`).
- TypeScript Mobile (`npx tsc --noEmit` desde `mobile`, si `npx` resuelve la instalación existente).
- ESLint enfocado en archivos modificados; ejecutar lint global si su costo es razonable.
- Expo export web si las dependencias locales están instaladas; no EAS ni publicación.
- `git diff --check`.
- Revisar diff para confirmar que no se tocaron las rutas locales previas ni se creó SQL.

## Interfaces y consumidores

- El contrato público exporta `CountryCode`, `CurrencyCode`, `LocaleCode`, `RegionalSettings`, `RegionalDefaults`, `TaxProfileReference` y `FiscalBehaviorBoundary`.
- `normalizeCountryCode`, `normalizeCurrencyCode`, `normalizeLocaleCode`, `normalizeTimeZone`, `getRegionalDefaults`, `formatCurrencyAmount` son funciones puras salvo Intl local.
- `src/lib/currency.ts` mantiene sus consumidores actuales y actúa como adaptador compatible.
- Mobile settings mantiene `CURRENCIES`, `currencySymbol` y `OrgSettings` para las pantallas actuales; Mobile `formatGs` conserva contrato PYG mientras backend/DTO no incluyan otra moneda.

## Riesgos / mitigaciones

- País aún no se persiste: el tipo permite `countryCode: null` y eso significa confirmación pendiente, no PY.
- La normalización alfa-2 valida forma de código; la futura API de persistencia debe validar membresía ISO oficial.
- US no elige una zona sin ciudad/estado: devuelve null y exige una elección explícita.
- `Intl.NumberFormat` puede usar espacios/símbolos regionales distintos según runtime; tests afirman código/precision semántica, no bytes idénticos por plataforma.
- Mobile cross-root import: el primer bundle sin configuración falló al resolver el módulo. Verificar el `watchFolder` estrecho con typecheck y nueva exportación Expo SDK 57; si sigue fallando, detener expansión y proponer paquete/workspace separado en vez de duplicar.

## Commits sugeridos

No crear commits en esta tarea. Si luego se autoriza, separar documentación de contrato de la implementación compartida, con staging selectivo de los archivos enumerados.
