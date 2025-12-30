# 📦 Migraciones de Base de Datos - Sistema de Productos

## 📋 Descripción

Este directorio contiene las migraciones SQL para crear y poblar la base de datos del sistema de productos en Supabase.

## 📁 Archivos

### 1. `20241206_create_products_tables.sql`
**Descripción:** Crea todas las tablas, índices, triggers y vistas necesarias para el sistema de productos.

**Incluye:**
- ✅ 6 tablas principales
- ✅ Índices optimizados
- ✅ Triggers automáticos
- ✅ Funciones de utilidad
- ✅ Vistas para consultas
- ✅ Políticas RLS (Row Level Security)

**Tablas creadas:**
1. `categories` - Categorías de productos (con jerarquía)
2. `suppliers` - Proveedores
3. `products` - Productos del inventario
4. `product_movements` - Historial de movimientos
5. `product_price_history` - Historial de precios
6. `product_alerts` - Alertas y notificaciones

### 2. `20241206_seed_products_data.sql`
**Descripción:** Inserta datos de ejemplo para testing y desarrollo.

**Incluye:**
- ✅ 11 categorías (con subcategorías)
- ✅ 5 proveedores
- ✅ 18 productos variados
- ✅ Movimientos de inventario
- ✅ Historial de precios

**Productos de ejemplo:**
- 📱 Electrónica (smartphones, laptops, accesorios)
- 👕 Ropa y accesorios (camisetas, jeans, tenis)
- 🏠 Hogar y jardín (electrodomésticos, cocina)
- ⚽ Deportes (balones, pesas)
- 🍯 Alimentos (café, aceite, miel)

## 🚀 Instalación

### Opción 1: Supabase Dashboard (Recomendado)

1. Abre tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **SQL Editor**
3. Crea una nueva query
4. Copia y pega el contenido de `20241206_create_products_tables.sql`
5. Ejecuta la query (Run)
6. Repite los pasos 3-5 con `20241206_seed_products_data.sql`

### Opción 2: Supabase CLI

```bash
# Asegúrate de estar en el directorio raíz del proyecto
cd /ruta/a/tu/proyecto

# Ejecutar migraciones
supabase db push

# O ejecutar manualmente
supabase db execute -f supabase/migrations/20241206_create_products_tables.sql
supabase db execute -f supabase/migrations/20241206_seed_products_data.sql
```

### Opción 3: psql (PostgreSQL CLI)

```bash
# Conectar a tu base de datos
psql "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres"

# Ejecutar scripts
\i supabase/migrations/20241206_create_products_tables.sql
\i supabase/migrations/20241206_seed_products_data.sql
```

## 🔍 Verificación

Después de ejecutar las migraciones, verifica que todo se creó correctamente:

```sql
-- Ver todas las tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%product%' 
  OR table_name IN ('categories', 'suppliers');

-- Contar registros
SELECT 
  (SELECT COUNT(*) FROM categories) as categorias,
  (SELECT COUNT(*) FROM suppliers) as proveedores,
  (SELECT COUNT(*) FROM products) as productos,
  (SELECT COUNT(*) FROM product_movements) as movimientos;

-- Ver productos con stock bajo
SELECT name, stock_quantity, min_stock 
FROM products 
WHERE stock_quantity <= min_stock;

-- Ver estadísticas generales
SELECT * FROM product_stats;
```

## 📊 Estructura de Datos

### Diagrama de Relaciones

```
categories
    ↓ (parent_id - auto-referencia)
categories
    ↓ (category_id)
products ← (supplier_id) ← suppliers
    ↓
    ├─→ product_movements
    ├─→ product_price_history
    └─→ product_alerts
```

### Campos Importantes

#### Products
```typescript
{
  // Identificación
  id: UUID
  sku: string (único)
  name: string
  barcode: string
  
  // Precios
  purchase_price: decimal
  sale_price: decimal
  wholesale_price: decimal
  offer_price: decimal
  has_offer: boolean
  
  // Inventario
  stock_quantity: integer
  min_stock: integer
  max_stock: integer
  
  // Multimedia
  images: string[] // Array de URLs
  
  // Relaciones
  category_id: UUID
  supplier_id: UUID
}
```

## 🎯 Características Especiales

### 1. Triggers Automáticos

#### Actualización de `updated_at`
Todas las tablas principales actualizan automáticamente el campo `updated_at` al modificarse.

#### Movimientos de Inventario
Cuando cambias el `stock_quantity` de un producto, se crea automáticamente un registro en `product_movements`.

```sql
-- Ejemplo: Esto crea un movimiento automático
UPDATE products 
SET stock_quantity = 50 
WHERE sku = 'IPHONE-14-PRO-128';
```

#### Alertas de Stock
Se crean alertas automáticas cuando:
- Stock <= min_stock (alerta de stock bajo)
- Stock = 0 (alerta de stock agotado)

### 2. Vistas Útiles

#### `products_full`
Vista con información completa de productos incluyendo nombres de categoría y proveedor.

```sql
SELECT * FROM products_full WHERE stock_status = 'low_stock';
```

#### `product_stats`
Vista con estadísticas generales del inventario.

```sql
SELECT * FROM product_stats;
-- Retorna: total_products, active_products, total_stock_value, etc.
```

### 3. Búsqueda de Texto Completo

Índice optimizado para búsqueda en español:

```sql
-- Buscar productos
SELECT * FROM products 
WHERE to_tsvector('spanish', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(brand, ''))
  @@ to_tsquery('spanish', 'iphone | samsung');
```

### 4. Row Level Security (RLS)

Todas las tablas tienen RLS habilitado. Las políticas actuales permiten acceso completo a usuarios autenticados.

**Personalizar políticas:**
```sql
-- Ejemplo: Solo lectura para usuarios normales
DROP POLICY "Allow all for authenticated users" ON products;

CREATE POLICY "Allow read for authenticated users" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow write for admins" ON products
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

## 🧪 Datos de Prueba

### Productos con Características Especiales

| SKU | Característica | Propósito |
|-----|----------------|-----------|
| `SAMSUNG-S23-256` | En oferta | Testing de precios promocionales |
| `CAFE-ARABICA-1KG` | Stock bajo (8/20) | Testing de alertas de stock bajo |
| `ACEITE-OLIVA-500ML` | Stock crítico (3/15) | Testing de alertas críticas |
| `MIEL-ORGANICA-500G` | Sin stock (0/10) | Testing de productos agotados |
| `IPHONE-14-PRO-128` | Featured | Testing de productos destacados |

### Categorías con Jerarquía

```
Electrónica
├── Smartphones
├── Laptops
└── Accesorios Tech

Ropa y Accesorios
├── Camisetas
├── Pantalones
└── Calzado
```

## 🔧 Mantenimiento

### Limpiar Datos de Ejemplo

```sql
-- Eliminar solo datos de ejemplo (mantener estructura)
TRUNCATE TABLE product_alerts CASCADE;
TRUNCATE TABLE product_price_history CASCADE;
TRUNCATE TABLE product_movements CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE suppliers CASCADE;
TRUNCATE TABLE categories CASCADE;
```

### Resetear Secuencias

```sql
-- Si usas secuencias para IDs numéricos
ALTER SEQUENCE products_id_seq RESTART WITH 1;
```

### Backup de Datos

```bash
# Backup completo
pg_dump -h [HOST] -U postgres -d postgres -t products -t categories -t suppliers > backup.sql

# Restaurar
psql -h [HOST] -U postgres -d postgres < backup.sql
```

## 📈 Optimización

### Índices Creados

- ✅ Índices en claves foráneas
- ✅ Índices en campos de búsqueda (name, sku, barcode)
- ✅ Índices en campos de filtro (is_active, stock_quantity)
- ✅ Índice de texto completo para búsqueda
- ✅ Índices en timestamps para ordenamiento

### Consultas Optimizadas

```sql
-- Búsqueda rápida por SKU (usa índice)
SELECT * FROM products WHERE sku = 'IPHONE-14-PRO-128';

-- Productos activos con stock (usa índices)
SELECT * FROM products 
WHERE is_active = true 
  AND stock_quantity > 0;

-- Productos de una categoría (usa índice)
SELECT * FROM products 
WHERE category_id = '11111111-1111-1111-1111-111111111111';
```

## 🐛 Solución de Problemas

### Error: "relation already exists"
**Causa:** Las tablas ya existen  
**Solución:** Elimina las tablas existentes o usa `CREATE TABLE IF NOT EXISTS`

### Error: "permission denied"
**Causa:** Usuario sin permisos suficientes  
**Solución:** Usa el usuario `postgres` o un usuario con permisos de superusuario

### Error: "RLS policy violation"
**Causa:** Políticas RLS muy restrictivas  
**Solución:** Ajusta las políticas o desactiva RLS temporalmente:
```sql
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
```

### Alertas no se crean automáticamente
**Causa:** Trigger no está activo  
**Solución:** Verifica que el trigger existe:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'check_product_stock';
```

## 📚 Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

## 🤝 Contribuir

Si encuentras algún problema o tienes sugerencias:
1. Reporta el issue
2. Propón mejoras
3. Envía un pull request

---

**Versión:** 1.0  
**Fecha:** Diciembre 2024  
**Autor:** Sistema de Gestión de Productos
