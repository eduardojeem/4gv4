# Implementación de Subcategorías en Productos Públicos

## Descripción
Se ha implementado soporte para subcategorías en la sección de productos públicos (`/productos`) con una interfaz moderna y mejorada. Esto permite organizar las categorías de forma jerárquica, mejorando la navegación cuando hay muchas categorías.

## Cambios Realizados

### 1. Base de Datos
- **Migración**: `supabase/migrations/20260222_add_subcategories_support.sql`
- Se asegura que la columna `parent_id` existe en la tabla `categories`
- Se agrega constraint de foreign key para mantener integridad referencial
- Se crea índice para optimizar consultas de jerarquía

### 2. API Backend

#### `/api/public/categories`
- Ahora devuelve categorías con estructura jerárquica
- Incluye campo `subcategories` en cada categoría principal
- Mantiene compatibilidad con cache (5 minutos)

#### `getPublicCategories()` en `src/lib/api/products-server.ts`
- Organiza categorías en estructura de árbol
- Categorías sin `parent_id` son raíces
- Subcategorías se agrupan bajo su categoría padre

### 3. Frontend - Mejoras Visuales

#### `ProductFilters.tsx` - Diseño Moderno
**Mejoras generales:**
- Fondo de card con sombra sutil para mejor separación visual
- Badges de filtros activos con fondo destacado y hover mejorado
- Contador de filtros activos con badge de color primario
- Botón "Limpiar" con efecto hover destructivo
- Iconos para cada sección de filtros (Package, Layers, DollarSign, Tag)

**Categorías principales:**
- Diseño de botón con indicador circular de estado
- Fondo completo en color primario cuando está seleccionada
- Badge con contador de subcategorías
- Efecto hover suave con transición
- Indicador visual cuando tiene subcategorías seleccionadas
- **Botón de expandir/contraer** con iconos ChevronDown/ChevronRight
- Las subcategorías se contraen/expanden al hacer clic en el chevron
- Auto-expansión cuando una subcategoría está seleccionada

**Subcategorías:**
- Indentación con borde lateral decorativo
- Diseño más compacto que las categorías principales
- Borde sutil cuando está seleccionada
- Efecto de desplazamiento al hacer hover
- Indicador circular más pequeño
- **Animación suave** al expandir/contraer (slide-in-from-top)
- Se ocultan cuando la categoría padre está contraída

**Disponibilidad:**
- Fondo destacado con hover
- Indicador de estado con color verde cuando está activo
- Switch mejorado con mejor contraste

**Rango de Precio:**
- Cajas separadas para mínimo y máximo
- Etiquetas descriptivas en mayúsculas
- Fondo sutil para mejor legibilidad
- Slider con mejor feedback visual

**Marcas:**
- Diseño consistente con categorías principales
- Scroll personalizado para listas largas
- Indicador circular de estado
- Fondo completo en color primario cuando está seleccionada

#### Tipos TypeScript
- Actualizado `Category` en `src/types/public.ts` para incluir:
  - `parent_id?: string | null`
  - `subcategories?: Category[]`

## Uso

### Crear Subcategorías
Para crear una subcategoría, simplemente asigna el `parent_id` al ID de la categoría padre:

```sql
-- Ejemplo: Crear subcategoría "iPhone" bajo "Celulares"
INSERT INTO categories (name, parent_id)
VALUES ('iPhone', (SELECT id FROM categories WHERE name = 'Celulares'));
```

### Visualización
- Las categorías principales se muestran con indicador circular y badge de contador
- Las subcategorías aparecen indentadas con borde lateral
- Ambas son clickeables para filtrar productos
- El filtro activo se muestra como badge removible con hover mejorado
- Efectos visuales claros para indicar estado seleccionado/hover

## Estructura Visual

```
Categorías
├─ 📱 Celulares (3)
│  ├─ iPhone
│  ├─ Samsung
│  └─ Xiaomi
├─ 🎧 Accesorios (3)
│  ├─ Fundas
│  ├─ Cargadores
│  └─ Audífonos
└─ 🔧 Repuestos (2)
   ├─ Pantallas
   └─ Baterías
```

## Características de UX

1. **Jerarquía Visual Clara**: Indentación, bordes y tamaños diferenciados
2. **Estados Interactivos**: Hover, selección y transiciones suaves
3. **Feedback Visual**: Indicadores de estado, contadores y colores semánticos
4. **Accesibilidad**: Labels descriptivos, aria-labels y contraste adecuado
5. **Responsive**: Diseño adaptable con scroll en listas largas
6. **Performance**: Transiciones CSS optimizadas y renders eficientes
7. **Expandir/Contraer**: Control de visibilidad de subcategorías con animación
8. **Auto-expansión**: Las categorías se expanden automáticamente si tienen una subcategoría seleccionada

## Beneficios
1. **Mejor organización**: Agrupa productos relacionados de forma lógica
2. **Escalabilidad**: Soporta crecimiento del catálogo sin saturar la UI
3. **UX mejorada**: Navegación más intuitiva con jerarquía visual clara
4. **Performance**: Índices optimizados para consultas rápidas
5. **Flexibilidad**: Categorías pueden ser principales o subcategorías según necesidad
6. **Diseño moderno**: Interfaz atractiva con efectos visuales profesionales

## Compatibilidad
- Totalmente compatible con categorías existentes (sin `parent_id`)
- No requiere cambios en productos existentes
- El filtrado funciona igual para categorías y subcategorías
- Diseño responsive que funciona en móvil y desktop
