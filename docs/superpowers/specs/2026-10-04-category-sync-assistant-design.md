# Asistente local para sincronizar categorías

Fecha: 2026-10-04

## Objetivo

Mejorar `/superadmin/categories` con un análisis manual y gratuito que ayude a resolver categorías de tiendas todavía no vinculadas. Debe detectar errores de escritura, nombres equivalentes, posibles duplicados y asociaciones incoherentes, sin depender de proveedores externos ni aplicar cambios automáticamente.

## Alcance

El asistente analiza únicamente categorías de tiendas cuyo `global_category_id` es nulo. Reutiliza la taxonomía global activa, sus alias, jerarquía y rubros. La decisión final siempre corresponde al SuperAdmin.

No se incorporan modelos generativos, claves de API, llamadas externas ni aprendizaje automático. “Inteligente” describe un motor local de reglas y puntuación explicable.

## Experiencia de usuario

La sección de categorías sin vincular tendrá un botón `Analizar categorías`. El análisis no se ejecutará al abrir la página.

Después del análisis, cada grupo sin vincular mostrará:

- la mejor categoría global sugerida;
- confianza `alta`, `media`, `baja` o `sin coincidencia`;
- razones legibles, por ejemplo `mismo nombre sin tildes`, `posible error de escritura`, `alias conocido` o `coincide el nombre pero no el rubro`;
- hasta dos alternativas adicionales;
- las acciones `Vincular`, `Elegir otra`, `Crear nueva` y `No corresponde`.

La selección masiva solo estará habilitada para sugerencias de confianza alta. Incluso entonces, el usuario debe confirmar antes de escribir.

Al vincular, el nombre de la tienda podrá guardarse como alias de la categoría global mediante el flujo transaccional existente. `No corresponde` será una decisión de interfaz durante esta primera versión; no se agregará una tabla de descartes hasta comprobar que sea necesaria.

## Motor de coincidencias

El análisis se ejecutará en el servidor para mantener una única implementación y evitar diferencias entre navegadores.

### Normalización

Se reutilizará la normalización existente y se ampliará de forma acotada para:

- minúsculas y eliminación de tildes;
- espacios y signos normalizados;
- singular/plural;
- palabras vacías frecuentes como `de`, `para`, `y`;
- tokens ordenados para reconocer variaciones como `accesorios celular` y `celular accesorios`.

### Señales

Cada candidato recibirá una puntuación combinada:

1. nombre o alias exacto normalizado;
2. similitud tipográfica para errores pequeños;
3. coincidencia de palabras relevantes;
4. compatibilidad con la categoría madre disponible;
5. compatibilidad de rubro o vertical;
6. penalización por nombres demasiado generales o por conflicto de jerarquía.

Las reglas exactas y sus umbrales vivirán en una función pura, sin acceso a base de datos, para que puedan probarse exhaustivamente. Los resultados se ordenarán de forma estable para que la misma entrada produzca siempre la misma recomendación.

### Confianza

- `alta`: coincidencia inequívoca por nombre, alias o puntuación claramente superior.
- `media`: buena semejanza, pero requiere revisar contexto o alternativas.
- `baja`: relación posible con ambigüedad importante.
- `sin coincidencia`: ninguna opción supera el umbral mínimo.

Nunca se presentará una confianza alta cuando dos categorías globales tengan puntuaciones cercanas. Los casos ambiguos deben quedar visibles, no resolverse de manera arbitraria.

## Arquitectura

### Dominio

Un módulo nuevo bajo `src/lib/categories/` expondrá tipos y funciones puras para analizar una categoría contra la taxonomía. El resultado incluirá identificador de destino, puntuación, confianza, razones y alternativas.

### API

La ruta existente `/api/superadmin/global-categories` incorporará una acción de análisis autenticada para SuperAdmin. Recibirá identificadores de grupos sin vincular o analizará la colección vigente con un límite cerrado. El servidor volverá a leer los datos actuales; no confiará en nombres o destinos enviados por el navegador.

La acción será solo de lectura. Las escrituras continuarán usando las RPC transaccionales ya implementadas. Antes de vincular se volverán a validar nombre, estado y destino para impedir decisiones obsoletas.

### Interfaz

`GlobalCategoriesManager` mantendrá el estado del análisis separado de los datos persistidos. Un componente específico mostrará confianza, razones y alternativas sin sobrecargar el listado principal. Al recargar las categorías, las sugerencias anteriores se invalidarán.

## Seguridad y límites

- Solo usuarios SuperAdmin podrán ejecutar el análisis.
- No se enviarán datos fuera de la infraestructura actual.
- Se limitará la cantidad de grupos y candidatos comparados por solicitud.
- El endpoint tendrá rate limit de prioridad baja para evitar trabajo repetitivo accidental.
- El análisis no escribirá categorías, alias ni vínculos.
- Las acciones confirmadas conservarán actor y auditoría existentes.

## Errores y estados vacíos

- Si falla el análisis, el listado actual seguirá siendo utilizable manualmente.
- Si no hay coincidencia suficiente, se recomendará crear o elegir una categoría, nunca una asociación inventada.
- Si la taxonomía está vacía, el botón explicará que primero deben crearse categorías globales.
- Si cambian las categorías mientras se revisan sugerencias, la operación transaccional rechazará el vínculo obsoleto y pedirá analizar nuevamente.

## Pruebas

Se cubrirán como mínimo:

- tildes, mayúsculas, singular y plural;
- errores tipográficos de uno o dos caracteres;
- palabras reordenadas;
- alias existentes;
- categorías homónimas bajo madres distintas;
- conflicto de rubro o jerarquía;
- empates que no deben producir confianza alta;
- ausencia de coincidencias;
- estabilidad del orden de resultados;
- autorización y límites del endpoint;
- botón manual, estados de carga, explicaciones y confirmación en UI;
- garantía de que analizar no produce escrituras.

## Criterios de aceptación

1. El análisis solo comienza al pulsar `Analizar categorías`.
2. Funciona sin claves ni servicios externos.
3. Cada sugerencia explica por qué fue propuesta.
4. Ningún vínculo se aplica sin confirmación explícita.
5. Los casos ambiguos o incompatibles no se presentan como seguros.
6. Confirmar una sugerencia reutiliza la operación transaccional y la auditoría existentes.
7. Un fallo del asistente no bloquea el flujo manual actual.

