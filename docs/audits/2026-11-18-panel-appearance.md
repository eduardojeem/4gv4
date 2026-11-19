# Apariencia del panel

## Auditoría y alcance

La sección solo previsualizaba botones/etiquetas, mientras algunos accesos del shell tenían azul, índigo o violeta fijos. Las preferencias se leían sin proteger errores de almacenamiento ni validar valores. Preparar una paleta personalizada podía alterar un esquema que no era custom y dejar tokens anteriores al reemplazar una paleta parcial.

Se conserva el alcance personal por navegador. No se guardan cambios de apariencia en la empresa ni se modifica la marca pública. Se preservó sin mezclar la implementación local pendiente de Mega Tienda Tech.

## Implementación

- Pantalla independiente con modo, paleta, tres acabados (Neutro, Con color y Contraste marcado), restablecimiento y una vista previa interactiva con navegación, tarjetas, pestañas, tabla y diálogo. La vista se identifica como ejemplo sin datos del negocio.
- Tokens de superficies, bordes y selección limitados a los shells de admin/dashboard y a los portales de sus diálogos y menús. Las alertas y estados semánticos no se recolorean por este acabado.
- Accesos principales y logo alternativo del shell siguen la paleta elegida.
- Lectura de almacenamiento protegida, normalización de preferencias, sincronización entre pestañas y limpieza de overrides personalizados obsoletos. El arranque anticipado restaura también paleta y acabado.
- Sin dependencias, cambios de esquema, migraciones, guardados de configuración de empresa ni publicación.

## Validación

Chrome con fixtures locales: 132 combinaciones de 11 paletas × 3 acabados × claro/oscuro × 390/1280 px. Sin desbordes ni errores JavaScript; contraste de tokens del botón principal mínimo 4,57:1 en claro y 5,37:1 en oscuro. Los diálogos siguen el acabado y la superficie fuera del panel no cambia al alternarlo. Preferencias escritas en almacenamiento local y restablecimiento comprobados.

Verificación final: TypeScript y ESLint de los archivos tocados terminaron con código 0; 89 pruebas pasaron en 10 archivos. También se comprobó la conservación de paleta y acabado al recargar. No se hicieron pruebas de operaciones con datos reales.
