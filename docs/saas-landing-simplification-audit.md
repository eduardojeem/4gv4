# Auditoria de simplificacion de /saas

## Problema encontrado

- La landing tenia demasiada informacion visible en la primera lectura.
- El hero mostraba metricas y elementos de panel que parecian datos reales, pero eran demostrativos.
- Las secciones repetian conceptos: modulos, negocios, planes, soporte y CTA explicaban demasiado.
- Habia muchas animaciones y tarjetas, lo que hacia mas dificil entender el camino principal.

## Cambios aplicados

- Hero mas directo:
  - beneficio principal claro
  - CTA principal `Empezar ahora`
  - CTA secundario `Ver marketplace`
  - panel demo reducido a tres acciones: vende, controla, atiende
- Caracteristicas simplificadas:
  - se paso de muchos modulos a cuatro bloques principales
  - se mantuvo el flujo de tres pasos para entender como empezar
- Negocios simplificado:
  - tarjetas mas limpias
  - menos etiquetas internas
  - mensaje enfocado en tiendas, service y sucursales
- Planes optimizados:
  - se muestran solo los limites y modulos principales
  - se elimino la seccion de notas explicativas para reducir ruido
- CTA final reducido:
  - mensaje corto
  - dos acciones claras

## Resultado

La ruta `/saas` queda mas intuitiva para un usuario nuevo: entiende que puede crear una empresa, operar ventas/stock/reparaciones y elegir un plan sin leer demasiada informacion tecnica.

## Recomendacion siguiente

Conectar cada CTA con eventos de conversion y medir:

- clicks en `Empezar ahora`
- clicks en `Ver marketplace`
- plan seleccionado
- abandono del formulario de registro
