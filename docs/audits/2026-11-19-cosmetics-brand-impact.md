# Cosméticos: mayor presencia del color de la tienda

Fecha: 2026-11-19. Rama: codex/cosmetics-brand-impact, desde main fffb2d78.

## Alcance aprobado

Usar la marca elegida en la portada, encabezado, categorías, ofertas y carrusel de Especial Cosméticos. Acciones intensas, fondos suaves y superficies neutras para productos. Se conservan los modos Claro, Color de marca y Oscuro del encabezado. No se altera la configuración de Paravos, el panel ni otras plantillas.

## Implementación

- Variables locales derivadas del primary del contenedor público; los rosados y fondos crema fijos pasan a tonos de marca.
- Fondos alternados de rutina, ofertas, catálogo y nosotros en ambos modos.
- Botones con luminosidad limitada para mantener sus etiquetas blancas legibles, incluyendo marcas muy claras.
- Carrusel con la misma paleta que el resto de la plantilla; elimina el mapa parcial de degradados fijos. Ignora colores personalizados antiguos cuando la paleta seleccionada ya no es custom y descarta valores inválidos.
- Los menús de cuenta que se montan fuera del contenedor conservan tonos neutrales, evitando heredar variables de otro ámbito.

## Verificación

- 55 pruebas aprobadas en 8 archivos; TypeScript y ESLint de lo tocado con código 0.
- Chrome con fixtures: encabezado, portada y carrusel reales; dependencias de datos, autenticación y ProductCard sustituidas por ejemplos. No se prueban operaciones reales.
- 192 combinaciones: 12 paletas y 4 colores personalizados, claro/oscuro, 390/1280 px y tres estilos de encabezado. Sin errores JavaScript ni desbordamientos. Contraste mínimo medido del botón principal: 4,59:1. Menú móvil y presentación del carrusel comprobados.
- Capturas con contenido de ejemplo: cosmetics-brand-390-light.png y variantes en la carpeta de visualizaciones.

Sin migraciones, nuevas dependencias, push ni despliegue. Los cambios anteriores de Mega Tech y Apariencia permanecen intactos en la worktree original.
