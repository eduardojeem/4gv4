# Paletas asistidas para tiendas

Fecha: 2026-11-19. Implementación local aprobada por el usuario.

La combinación pertenece a la tienda, no al navegador ni al panel. Incluye principal, complementario, fondo y texto, con recomendaciones por rubro/estilo y sugerencia local desde el logo. Se previsualiza antes de guardar con el formulario existente. Cambiar de plantilla conserva la combinación; elegir un color simple retira la combinación completa.

Se guarda como brandPalette dentro del JSON company_info, con validación HEX y contraste. Los layouts de ruta y subdominio, las miniaturas y el protocolo de vista previa aplican el mismo contrato de variables CSS. Las plantillas existentes reciben los roles comunes; sus fotografías y decisiones estructurales de diseño no se recolorean. Se adaptan acentos fijos conocidos de las plantillas especiales.

Sin migraciones, servicios externos de IA ni operaciones en producción. Etapas: contrato y pruebas; selector y logo; guardado/vista previa; adaptación de plantillas; verificación de tipos, lint, pruebas y Chrome.

## Resultado y validación

- Recomendaciones por rubro real y estilo; cuatro alternativas iniciales con opción de ver todas. Colores manuales con previsualización y bloqueo de contraste insuficiente. Sugerencia desde logo existente o PNG/JPG/WebP local de hasta 5 MB, sin reemplazarlo ni subirlo.
- La combinación viaja por el formulario, validación, JSON company_info y protocolo seguro del iframe. Los layouts de ruta y subdominio aplican los mismos roles; cambiar de plantilla la conserva. Un color simple permite retirarla.
- Detección normalizada en useStorefrontCompanyInfo: las plantillas usan la combinación aun si quedó un color antiguo en el registro. Los tonos de acciones demasiado claros se oscurecen para mantener legibilidad con los encabezados y botones existentes.
- 178 pruebas aprobadas en 15 archivos; TypeScript y ESLint de archivos tocados terminaron con código 0. Se comprobó persistencia y rechazo antes de escrituras con API simulada. Dos expectativas anteriores se actualizaron: aceptar propiedades adicionales del pie y normalizar CRLF en una prueba estática.
- Chrome con fixtures del asistente y miniaturas reales: 504 combinaciones (9 paletas, 14 plantillas, claro/oscuro, 390/1280 px). Contraste mínimo medido del botón principal: 4,98:1. Comprobados complementario exacto, lectura, ausencia de desbordes/errores, aislamiento de administración, cambio de plantilla y análisis real de logo en canvas.
- Capturas: palette-assistant-390-light.png y variantes en la carpeta de visualizaciones. Son ejemplos, no una sesión autenticada sobre datos reales.

Para nuevas plantillas: consumir primary/secondary/background/foreground/card/accent, usar sus foreground asociados y el contexto de empresa compartido. Evitar fijar colores de marca en clases o valores HEX. Los colores propios de fotografías y banners no se transforman; la estructura oscura o editorial de cada diseño se mantiene.

Rama local codex/storefront-palette-assistant. No se subió ni publicó esta función; los commits anteriores continúan en el PR #153 por separado.
