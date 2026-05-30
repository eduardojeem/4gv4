# Auditoria de la seccion /saas

## Estado anterior

- La pagina `src/app/saas/page.tsx` mezclaba contenido, datos, iconos y layout en un solo archivo.
- Las secciones principales existian, pero no estaban separadas como modulos mantenibles.
- El hero era generico y la propuesta SaaS no mostraba con claridad el aislamiento multiempresa, planes, modulos y marketplace.
- Planes, caracteristicas y negocios compartian demasiado la misma composicion visual.

## Cambios aplicados

- `src/app/saas/page.tsx` ahora solo compone la landing.
- Se creo `src/components/saas/landing/saas-landing-data.ts` para centralizar planes, caracteristicas, negocios, flujo y soporte.
- Se separaron las secciones:
  - `saas-hero-section.tsx`
  - `saas-features-section.tsx`
  - `saas-business-section.tsx`
  - `saas-plans-section.tsx`
  - `saas-cta-section.tsx`
- La navegacion existente mantiene:
  - Marketplace
  - Caracteristicas
  - Negocios
  - Planes
- Los planes ahora muestran limites y modulos habilitados por cada nivel.
- La seccion de negocios queda separada de marketplace y de las paginas publicas de empresa.
- Se crearon paginas dedicadas para las secciones comerciales:
  - `/saas/negocios`
  - `/saas/planes`
- La navegacion publica ahora apunta a esas paginas dedicadas para que Negocios y Planes no dependan solo de anclas internas.
- El sitemap publico incluye `/saas/negocios` y `/saas/planes`.

## Resultado

La ruta `/saas` queda como landing comercial modular, y las rutas `/saas/negocios` y `/saas/planes` funcionan como secciones aparte para usuarios que necesitan comparar por tipo de negocio o por plan.

## Recomendaciones siguientes

- Conectar los planes visuales con la tabla real de limites SaaS.
- Ampliar `/saas/planes` con una comparativa completa cuando se definan precios, limites y billing reales.
- Registrar eventos de conversion en los botones de registro.
- Agregar testimonios o logos reales cuando existan clientes activos.
