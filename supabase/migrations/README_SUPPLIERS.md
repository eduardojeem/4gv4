# Guía de Ejecución de Migraciones de Proveedores

## 📋 Scripts Organizados en Orden de Ejecución

Los scripts de migración para el módulo de proveedores están ahora organizados en el orden correcto:

### 1️⃣ [20251130010000_create_suppliers_table.sql](file:///c:/Users/4g/Desktop/4g/4g3/4gv4/supabase/migrations/20251130010000_create_suppliers_table.sql)
**Propósito:** Crear la tabla base `suppliers` con todas las columnas necesarias.

**Contenido:**
- Tabla `suppliers` con campos: id, name, contact_person, email, phone, address, city, country, postal_code, website, business_type, status, rating, products_count, total_orders, total_amount, notes
- Índices para optimización de consultas
- Trigger para actualizar `updated_at` automáticamente

---

### 2️⃣ [20251130010001_create_supplier_related_tables.sql](file:///c:/Users/4g/Desktop/4g/4g3/4gv4/supabase/migrations/20251130010001_create_supplier_related_tables.sql)
**Propósito:** Crear tablas relacionadas con proveedores.

**Contenido:**
- `supplier_products` - Productos ofrecidos por cada proveedor
- `purchase_orders` - Órdenes de compra a proveedores
- `purchase_order_items` - Items de cada orden de compra
- `inventory_reorders` - Gestión de reorden de inventario

---

### 3️⃣ [20251130010002_rls_suppliers.sql](file:///c:/Users/4g/Desktop/4g/4g3/4gv4/supabase/migrations/20251130010002_rls_suppliers.sql)
**Propósito:** Configurar Row Level Security (RLS) para todas las tablas.

**Contenido:**
- Habilitar RLS en todas las tablas
- Políticas de lectura para usuarios autenticados
- Políticas de escritura solo para administradores

---

### 4️⃣ [20251130010003_seed_suppliers.sql](file:///c:/Users/4g/Desktop/4g/4g3/4gv4/supabase/migrations/20251130010003_seed_suppliers.sql)
**Propósito:** Insertar datos de prueba.

**Contenido:**
- 5 proveedores de ejemplo
- Productos de ejemplo vinculados a proveedores
- Una orden de compra de ejemplo

---

### 5️⃣ [20251130010004_create_supplier_stats_function.sql](file:///c:/Users/4g/Desktop/4g/4g3/4gv4/supabase/migrations/20251130010004_create_supplier_stats_function.sql)
**Propósito:** Crear función RPC para obtener estadísticas de proveedores.

**Contenido:**
- Función `get_supplier_stats()` que retorna estadísticas agregadas
- Optimización para evitar múltiples queries desde el cliente

---

### 6️⃣ [20251130010005_seed_purchase_order_items.sql](file:///c:/Users/4g/Desktop/4g/4g3/4gv4/supabase/migrations/20251130010005_seed_purchase_order_items.sql)
**Propósito:** Insertar items de órdenes de compra de ejemplo.

---

### 7️⃣ [20251130010006_update_supplier_totals.sql](file:///c:/Users/4g/Desktop/4g/4g3/4gv4/supabase/migrations/20251130010006_update_supplier_totals.sql)
**Propósito:** Actualizar totales agregados en la tabla suppliers.

**Contenido:**
- Actualizar `total_orders` y `total_amount` desde `purchase_orders`
- Actualizar `products_count` desde `supplier_products`

---

## 🚀 Cómo Ejecutar las Migraciones

### Opción 1: Aplicar Todas las Migraciones (Recomendado)

```bash
# Desde la raíz del proyecto
npx supabase db reset
```

Este comando aplicará todas las migraciones en orden automáticamente.

### Opción 2: Aplicar Solo las Nuevas Migraciones

```bash
npx supabase db push
```

### Opción 3: Ejecutar Manualmente (Solo si es necesario)

Si necesitas ejecutar los scripts manualmente en Supabase Studio:

1. Abre Supabase Studio: http://localhost:54323
2. Ve a **SQL Editor**
3. Ejecuta cada script en el orden listado arriba (1 → 7)

---

## ✅ Verificación

Después de ejecutar las migraciones, verifica que todo esté correcto:

### 1. Verificar Tablas Creadas

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%supplier%'
ORDER BY table_name;
```

**Resultado esperado:**
- `suppliers`
- `supplier_products`
- `purchase_orders`
- `purchase_order_items`
- `inventory_reorders`

### 2. Verificar Datos de Prueba

```sql
SELECT name, business_type, status, rating 
FROM suppliers 
ORDER BY name;
```

**Resultado esperado:** 5 proveedores

### 3. Probar Función de Estadísticas

```sql
SELECT get_supplier_stats();
```

**Resultado esperado:** JSON con estadísticas agregadas

### 4. Verificar en la Aplicación

1. Navega a: http://localhost:3000/dashboard/suppliers
2. Deberías ver los 5 proveedores de prueba
3. Las estadísticas deberían mostrarse correctamente

---

## 🔧 Troubleshooting

### Error: "relation suppliers already exists"

Si ya tienes la tabla `suppliers` creada, puedes:

```bash
# Resetear completamente la base de datos
npx supabase db reset
```

### Error: "function get_supplier_stats() does not exist"

Verifica que el script 4 se ejecutó correctamente. Puedes ejecutarlo manualmente desde SQL Editor.

### Los datos de prueba no aparecen

Ejecuta manualmente los scripts 3, 5 y 6 en orden.
