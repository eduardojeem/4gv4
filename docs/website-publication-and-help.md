# Publicación voluntaria y configuración del sitio

## Uso

En `/admin/website`, comenzar por **Empresa** y **Pagos y entregas**. Cada pestaña tiene un botón **Cómo funciona** con instrucciones y ejemplos de distintos rubros. Las opciones secundarias de Empresa y las vistas explicativas se despliegan cuando se necesitan.

**Publicar tienda** habilita el enlace directo y las API públicas de la organización. **Visibilidad en Marketplace General** permite además descubrirla en el directorio y catálogo general. Un bloque de portada habilitado no publica por sí solo una tienda privada.

Para publicar: completar nombre, teléfono y WhatsApp con código de país si la modalidad es WhatsApp, activar la publicación, guardar y confirmar el resumen. El servidor vuelve a validar estos requisitos; no basta con cambiar un valor en el navegador. Si falla el guardado relacionado, no se activa una tienda que estaba privada.

Al ocultar la tienda se desactiva también el Marketplace. Se bloquean los enlaces públicos, incluido seguimiento público de pedidos/reparaciones; no se eliminan datos ni se impide operar desde el dashboard.

Las organizaciones nuevas empiezan privadas y con **Consultas por WhatsApp**. Una consulta abre un mensaje sobre el producto: no registra automáticamente una venta ni descuenta inventario. Las organizaciones existentes conservan su modalidad guardada (o el antiguo carrito implícito).

## Decisión técnica

La fuente de verdad de publicación es `organizations.storefront_public`; la de descubrimiento sigue siendo `organizations.marketplace_public`. Se separaron porque el formulario anterior describía Marketplace como un directorio, pero los resolutores del catálogo lo usaban también para bloquear el enlace directo.

Los resolutores públicos y el layout comprueban publicación desde el servidor. Los listados de Marketplace requieren ambos indicadores. Los alias de slugs no eluden el control. Las respuestas del catálogo, categorías y ajustes públicos usan `no-store`; guardar la empresa invalida las páginas de la tienda y Marketplace. Una pestaña ya abierta puede conservar contenido recibido previamente hasta recargarse. La política restrictiva de `website_settings` evita que antiguas políticas permisivas permitan leer los ajustes de una tienda oculta mediante la Data API; conserva los permisos administrativos existentes.

Los valores predeterminados compartidos de checkout mantienen el carrito por compatibilidad con registros antiguos. La base inicializa explícitamente `commerceMode: whatsapp` al crear una organización, sin sobrescribir ajustes existentes. Completar o repetir el onboarding ya no activa la publicación.

## Aplicación: SQL antes que código

1. Respaldar/verificar la base de destino y probar en staging.
2. Ejecutar `supabase/migrations/20260903033245_storefront_publication_opt_in.sql` completo. La migración es transaccional. Copia el estado anterior de acceso a `storefront_public` únicamente cuando falta el nuevo valor; no publica empresas existentes que estaban ocultas.
3. Desplegar el código después de aplicar la migración. Sin la columna nueva, las consultas devolverán error: no desplegar primero el código.
4. Probar una organización nueva: ambos indicadores deben ser falsos y checkout debe ser WhatsApp.
5. Probar una existente: modalidad, productos y acceso anterior conservados. Publicar solo el enlace y comprobar que no aparece en Marketplace; habilitar Marketplace; ocultar y comprobar páginas, API y alias con un navegador sin sesión.
6. Verificar nombre/contacto inválidos, cancelación del modal, falla de guardado, permisos de otra organización y retorno del onboarding sin republicación.

## Verificación local y límites

Las pruebas automatizadas cubren la política, resolutores, alias, ofertas, confirmación del formulario, rechazos del backend y ayudas. Las pruebas de contrato SQL **no sustituyen** ejecutar la migración en PostgreSQL ni verificar RLS con los roles reales.

La migración completa se ejecutó y repitió en PostgreSQL temporal (PGlite) con un esquema mínimo y permisos simulados: sintaxis, conservación de datos, registro privado, WhatsApp inicial, onboarding y política restrictiva aprobados. Se reproduce con `npm exec --yes --package=@electric-sql/pglite@0.5.8 -- node scripts/check-storefront-publication-migration.mjs`; no instala dependencias del proyecto ni usa secretos. Esto no verifica el esquema y las políticas reales de Supabase.

En esta sesión no se aplicó la migración en Supabase ni en su stack Docker local, que no estaba disponible. El navegador integrado no tenía acceso al panel privado (redirigía a `/saas`).

La revisión global detectó problemas previos ajenos a este cambio: `OrganizationDetailModal.tsx` pasa `title` a un icono Lucide, `website-default-settings.test.ts` espera otro valor para `processSectionEnabled` y `marketplace.ts` conserva tres usos de `any` detectados por lint.

## Recuperación

No borrar columnas ni checkout para revertir la interfaz. Mantener los controles server-side hasta decidir explícitamente qué tiendas pueden quedar públicas; volver al código anterior eliminaría la separación de publicación y descubrimiento. Ante un fallo de despliegue, corregir hacia delante o pausar el tráfico público mientras se verifica la migración. No restaurar la publicación automática del onboarding.
