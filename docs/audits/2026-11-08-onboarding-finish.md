# Configuración de tienda: pasos y guardado final

## Cambios
/admin/onboarding conserva el recorrido por pasos incluso cuando existe una configuración anterior. Rubro y herramientas, datos/contacto, cobro/entrega, tienda, redes y revisión final. Se puede volver a pasos visitados. El aviso de guardado aparece únicamente al responder correctamente el guardado final. Un fallo conserva el borrador y el error; no muestra éxito.

Rubro y herramientas permite elegir módulos del plan o aplicar recomendaciones. La selección actual se lee de enabled_modules. El backend rechaza funciones no incluidas y dependencias incompletas antes de escribir. El catálogo compartido agrega Agenda y servicios para negocios por turnos. No cambia el plan ni los permisos del usuario.

El asistente inicial compartido avanza localmente: no llama PATCH al tocar Siguiente. Al confirmar el resumen persiste los pasos 2/3/4 con sus revisiones y luego llama complete. Se conserva la revisión confirmada ante un fallo parcial y se revisa un conflicto entre dispositivos antes de reintentar. No se marca completado antes del POST final. El borrador es local por organización, se limpia al terminar y la página remonta el componente al cambiar de organización.

## Verificación
155 tests en 14 archivos del alcance pasan, incluyendo avance sin escritura, confirmación final, errores, conflictos, herramientas sin entitlement y dependencias incompletas. TypeScript raíz y ESLint del alcance pasan. Chrome con fixtures y APIs interceptadas: cero escrituras al avanzar; legacy hace un POST final; compartido hace tres PATCH y un POST solo al confirmar; éxito visible tras respuesta; cero errores de JS y sin desbordamiento horizontal a 375 px.

## Límites
Sin migración ni cambios en producción, commit, push o deploy. Se mantienen contratos de RPC existentes. El guardado compartido encadena las operaciones existentes y puede conservar avances si falla un paso durante la confirmación; el borrador queda recuperable y el negocio no se presenta como completado. La ruta legacy ya tiene operaciones auxiliares separadas: esta mejora no promete una transacción global nueva ni altera reglas de publicación o moneda.
