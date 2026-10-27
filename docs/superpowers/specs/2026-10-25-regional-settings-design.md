# Regional settings: contrato y diccionario de datos

Fecha: 2026-10-25
Estado: diseño de Fase 1 para preparar el contrato de aplicación; sin migración ni persistencia nueva.

## Intención

MiTiendaPy debe pasar de defaults centrados en Paraguay a una configuración regional explícita por organización, sin reinterpretar importes ni asignar países por inferencia. Web y Mobile necesitan consumir el mismo contrato antes de cambiar onboarding o marketplace.

## Objetivos

- Definir códigos y tipos regionales compartidos por Next.js y Expo.
- Mantener moneda base, locale y zona horaria como decisiones independientes.
- Proveer defaults sugeridos para PY, BR y AR; para US sugerir moneda y locale, pero exigir selección de zona horaria.
- Representar organizaciones antiguas sin país como pendientes de confirmación, preservando sus valores regionales heredados.
- Documentar límites fiscales, herencia de sucursal, exposición pública e historia financiera.

## No objetivos y límites

- No cambiar onboarding, marketplace, APIs, almacenamiento de Supabase, RLS ni migraciones.
- No convertir precios, saldos, créditos ni valores históricos.
- No implementar FX, perfiles fiscales por país, localización de traducciones o prefijos SEO.
- No solucionar en esta fase los hallazgos independientes del endpoint de metadatos ni de ofertas.
- No asignar país usando moneda, teléfono, ciudad, RUC, dirección o timezone.

## Enfoques considerados

1. Compartir un módulo TypeScript puro en `src/lib/regional` y consumirlo desde Web y Mobile. La exportación real de Expo mostró que Metro no resuelve por defecto este archivo fuera de `mobile`; se agregará `mobile/metro.config.js` con un único `watchFolder` para `src/lib/regional`, sin añadir dependencias ni incluir el árbol web completo. Es la opción elegida porque establece una sola fuente de tipos y funciones con cambios pequeños.
2. Mantener catálogos/helpers duplicados en `src` y `mobile/src`. Se descarta porque perpetúa diferencias entre plataformas.
3. Crear un paquete npm workspace. Se descarta en esta fase: el repositorio mantiene instalaciones y lockfiles separados para Web y Mobile; introducir workspaces altera resolución, instalación y CI sin aportar valor al módulo puro.

## Diccionario de datos objetivo

| Campo de contrato | Significado | Fuente de verdad futura | Estado y propiedad |
|---|---|---|---|
| `countryCode` | País primario de la organización, ISO 3166-1 alpha-2 en mayúscula | Columna `organization_settings.country_code`; la API lo expone como parte de `RegionalSettings` | No existe aún; dueño: organización; onboarding debe confirmarlo explícitamente |
| `baseCurrency` | Moneda comercial base, ISO 4217 | Campo actual `organization_settings.currency` | Existe; dueño: organización; no cambia importes ni convierte valores |
| `timezone` | Zona IANA de fechas/horarios del negocio | Campo actual `organization_settings.timezone` | Existe; dueño: organización; default heredado no confirma país |
| `locale` | Locale BCP-47 de visualización/formato | Futuro campo tipado en ajustes de organización; compatibilidad temporal con `modules.admin_settings.language` | Hoy solo hay preferencia de idioma heredada; no debe derivarse de moneda |
| `countryConfirmation` | Estado explícito de selección de país | Derivado: `countryCode == null` implica `needs_confirmation` | No persistido; no inferir el país de datos antiguos |
| `branch regional values` | País, moneda, locale y timezone aplicables a cada sucursal | Herencia desde organización en v1 | No crear overrides por sucursal |
| `tax profile` | Configuración fiscal genérica permitida para el país | Futuro perfil fiscal elegido por la organización | Fase posterior; país delimita opciones, organización es dueña de la elección |
| `pricesIncludeTax` | Indica si los precios de la operación incluyen impuestos | Configuración/contrato fiscal de operación | Legacy puede ser desconocido; no inferir ni aplicar nuevos cálculos aquí |
| `public country/currency` | Identidad regional mínima de una publicación | DTO público explícito y consentido | No incluir datos fiscales internos automáticamente |
| `subscription currency` | Moneda del cobro SaaS de MiTiendaPy | Contrato de planes/pagos SaaS, separado del negocio | Hoy el pago conserva moneda, pero el plan no tiene moneda explícita; hoy varios flujos son PYG |

La persistencia actual de `currency` y `timezone` está en `organization_settings`, por lo que se recomienda añadir ahí `country_code` y posteriormente `locale`, no duplicarlos en `organizations`. El API/domain contract tendrá nombres semánticos `baseCurrency` y `countryCode`; el adaptador de persistencia puede seguir mapeando `baseCurrency` a la columna heredada `currency`.

## Tipos y normalización

- `CountryCode`: tipo de dominio para códigos alfa-2 normalizados. La normalización de Fase 1 valida la forma ASCII de dos letras y conserva extensibilidad; la futura frontera de persistencia debe validar contra un catálogo ISO autoritativo. El catálogo de defaults habilitados empieza con PY, BR, AR y US, y no limita el tipo a esos cuatro.
- `CurrencyCode`: código admitido por el catálogo de moneda actual de la aplicación, normalizado a mayúsculas y compatible con ISO 4217. Agregar una moneda requiere incorporarla al catálogo compartido.
- `LocaleCode`: locale BCP-47 normalizado, independiente de país y moneda.
- `TimeZone`: identificador IANA verificado por Intl; no es un offset ni un nombre de ciudad.
- Entradas mal formadas se rechazan (`null` en los normalizadores); no se sustituyen silenciosamente por un país.

## Defaults sugeridos

| País | Moneda | Locale | Zona horaria sugerida | Confirmación |
|---|---|---|---|---|
| PY | PYG | es-PY | America/Asuncion | El onboarding solicita confirmación de los valores regionales |
| BR | BRL | pt-BR | America/Sao_Paulo | La zona es sugerida y editable antes de guardar |
| AR | ARS | es-AR | America/Argentina/Buenos_Aires | La zona es sugerida y editable antes de guardar |
| US | USD | en-US | Sin default nacional | El usuario debe elegir una zona IANA |

Para otro código con forma alfa-2 pero sin defaults registrados, no se asigna ningún valor regional por inferencia; se requiere configuración explícita. Los defaults son sugerencias de onboarding, no escrituras automáticas.

## Impuestos: frontera, no rediseño

El dominio debe usar conceptos genéricos como `TaxProfile`, `TaxRate` y `pricesIncludeTax`, sin interfaces ligadas a nombres de impuestos de un país. El país determina perfiles/reglas disponibles; la organización elige y posee su configuración fiscal. La Fase 1 no normaliza el JSON actual ni modifica cómo POS, productos o reparaciones calculan impuestos.

## Ownership, fallback y mutabilidad

- La organización es dueña de país primario, moneda base, locale y timezone.
- En v1 las sucursales heredan esos valores y no pueden reemplazarlos.
- Cambio de país requiere confirmación explícita; cambio de moneda no convierte saldos ni importes existentes.
- En organizaciones antiguas sin país, se conservan currency/timezone/language efectivos y se informa `needs_confirmation`; no se inventa un `countryCode`.
- Los defaults solo se aplican al nuevo onboarding cuando la persona confirma. Un fallback visual legado no se considera país confirmado.

## Contratos públicos

Futuras APIs de storefront/marketplace podrán exponer `countryCode`, `currencyCode` y ubicación pública consentida (región/ciudad). No exponen `TaxProfile`, tasas internas, identificadores fiscales ni ajustes privados salvo que exista campo público explícito y consentimiento para publicarlo. La publicación continúa limitada al tenant y a campos permitidos.

## Historia financiera

Regla: cambiar la configuración regional actual nunca debe reinterpretar operaciones históricas. La fase futura de snapshots debe guardar al menos moneda y contexto fiscal aplicado en ventas, partidas, pedidos y créditos donde esos valores necesiten reproducirse. Esta fase no cambia históricos; sin snapshots existentes no se inventan monedas o tasas pasadas.

## Onboarding futuro

1. Seleccionar país.
2. Mostrar sugerencias de moneda, locale y timezone.
3. Exigir selección de timezone para países sin default único, y permitir cambiar las otras sugerencias.
4. Confirmar y persistir país + configuración regional con la organización.
5. Mostrar estado pendiente en organizaciones legacy hasta que un usuario autorizado confirme país.

El wizard usará el contrato compartido; la API de servidor valida y persiste. Web y Mobile no mantendrán catálogos regionales independientes.

## Impacto de base de datos posterior

No se requiere migración para implementar y probar el contrato de aplicación en esta fase. La futura persistencia requerirá decidir y autorizar:

- `organization_settings.country_code`: `text`/`char(2)` con validación ISO en servidor y restricción de formato en DB.
- `organization_settings.locale`: texto BCP-47 validado por aplicación; se define junto al retiro/compatibilidad del actual `modules.admin_settings.language`.
- Backfill: país queda NULL para organizaciones existentes; solicitar confirmación, sin inferencia. Mantener intactos currency/timezone existentes.
- RLS: conservar las políticas organizacionales existentes para lectura/escritura de `organization_settings`; el cliente no debe poder cambiar de organización ajena.
- APIs: ampliar settings shared, onboarding, registration y public DTO con contratos diferenciados; no exponer país/moneda hasta definir consentimiento público.
- Históricos: snapshots son una dependencia distinta y no se backfillean con inferencias.

## Riesgos y validación

- Las monedas/idiomas de `system_settings` y las listas móviles son contratos heredados; esta fase compartirá el catálogo sin cambiar APIs ni datos.
- Expo debe poder empaquetar el módulo puro importado desde el root del repositorio; el `watchFolder` acotado se valida mediante TypeScript Mobile y export de bundle.
- El formatter mantiene la salida visible de PYG; no se migran masivamente pantallas ni se deduce moneda para DTOs públicos que no la incluyen.
- Pruebas cubren normalización, defaults, zona horaria de US, independencia de locale/moneda, PYG sin centavos y el uso compartido por Web/Mobile.
