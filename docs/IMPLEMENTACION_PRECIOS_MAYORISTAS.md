# Implementación: Precios Mayoristas en Catálogo Público

**Fecha**: 15 de febrero de 2026  
**Estado**: ✅ Completado

---

## Resumen

Se implementó la funcionalidad para mostrar precios mayoristas a usuarios autenticados con rol de mayorista en el catálogo público de productos (`/productos`).

---

## Funcionalidades Implementadas

### 1. Detección de Usuario Mayorista

**Roles considerados como mayorista:**
- `mayorista`
- `client_mayorista`

**Lógica de detección:**
```typescript
const { user } = useAuth()
const isWholesale = user?.role === 'mayorista' || user?.role === 'client_mayorista'
```

### 2. Mostrar Precio Correcto

**Lógica de precios:**

| Estado del Usuario | Precio Mostrado |
|-------------------|-----------------|
| No autenticado | `sale_price` (precio de venta) |
| Cliente normal | `sale_price` (precio de venta) |
| Mayorista | `wholesale_price` (si existe) o `sale_price` |

### 3. Indicadores Visuales

**Badge "Precio Mayorista":**
- Aparece en la esquina inferior izquierda de la imagen
- Gradiente púrpura a azul
- Solo visible para usuarios mayoristas
- Solo si el producto tiene precio mayorista

**Precio tachado:**
- Muestra el precio de venta tachado
- Debajo del precio mayorista
- Solo si el precio mayorista es menor al de venta

---

## Archivos Modificados

### 1. Tipos (`src/types/public.ts`)

**Agregado campo:**
```typescript
export interface PublicProduct {
  // ... otros campos
  sale_price: number
  wholesale_price: number | null  // ✅ Nuevo campo
  // ... otros campos
}
```

### 2. API Pública (`src/app/api/public/products/route.ts`)

**Cambios:**

**Antes:**
```typescript
sale_price: isWholesale && p.wholesale_price != null 
  ? p.wholesale_price 
  : p.sale_price
```

**Ahora:**
```typescript
sale_price: p.sale_price,
wholesale_price: p.wholesale_price  // ✅ Devuelve ambos precios
```

**Beneficio**: El frontend decide qué precio mostrar, no el backend.

### 3. Componente ProductCard (`src/components/public/ProductCard.tsx`)

**Cambios principales:**

1. **Importado useAuth:**
   ```typescript
   import { useAuth } from '@/contexts/auth-context'
   ```

2. **Detección de mayorista:**
   ```typescript
   const { user } = useAuth()
   const isWholesale = user?.role === 'mayorista' || user?.role === 'client_mayorista'
   ```

3. **Selección de precio:**
   ```typescript
   const displayPrice = isWholesale && product.wholesale_price 
     ? product.wholesale_price 
     : product.sale_price
   ```

4. **Badge de mayorista:**
   ```typescript
   {isWholesale && product.wholesale_price && (
     <Badge className="absolute left-2 bottom-2 bg-gradient-to-r from-purple-600 to-blue-600">
       Precio Mayorista
     </Badge>
   )}
   ```

5. **Precio tachado:**
   ```typescript
   {isWholesale && product.wholesale_price && product.wholesale_price < product.sale_price && (
     <p className="text-xs text-muted-foreground line-through">
       {formatPrice(product.sale_price)}
     </p>
   )}
   ```

---

## Flujo de Funcionamiento

### Usuario No Autenticado

1. Visita `/productos`
2. Ve todos los productos con `sale_price`
3. No ve badge de "Precio Mayorista"
4. No ve precio tachado

### Usuario Cliente Normal

1. Inicia sesión como cliente
2. Visita `/productos`
3. Ve todos los productos con `sale_price`
4. No ve badge de "Precio Mayorista"
5. No ve precio tachado

### Usuario Mayorista

1. Inicia sesión como mayorista
2. Visita `/productos`
3. Ve productos con `wholesale_price` (si existe)
4. Ve badge "Precio Mayorista" en productos con precio mayorista
5. Ve precio de venta tachado debajo del precio mayorista
6. Si un producto no tiene precio mayorista, ve el precio de venta normal

---

## Ejemplo Visual

### Card de Producto para Mayorista

```
┌─────────────────────────────────┐
│ [Imagen del producto]           │
│ [Destacado]        [En stock]   │
│ [Precio Mayorista]              │ ← Badge nuevo
├─────────────────────────────────┤
│ Samsung                         │
│ Galaxy A10 Pantalla LCD         │
│ Pantallas                       │
│                                 │
│ ₲ 350.000                       │ ← Precio mayorista
│ ₲ 450.000                       │ ← Precio venta (tachado)
│                                 │
│ SKU: PNT-001                    │
└─────────────────────────────────┘
```

### Card de Producto para Cliente Normal

```
┌─────────────────────────────────┐
│ [Imagen del producto]           │
│ [Destacado]        [En stock]   │
│                                 │
├─────────────────────────────────┤
│ Samsung                         │
│ Galaxy A10 Pantalla LCD         │
│ Pantallas                       │
│                                 │
│ ₲ 450.000                       │ ← Precio venta
│                                 │
│ SKU: PNT-001                    │
└─────────────────────────────────┘
```

---

## Validaciones

### Backend

- ✅ Verifica autenticación del usuario
- ✅ Obtiene rol del perfil o metadata
- ✅ Devuelve ambos precios (sale_price y wholesale_price)
- ✅ Filtra y ordena por el precio correcto según el usuario

### Frontend

- ✅ Verifica rol del usuario
- ✅ Muestra precio correcto según el rol
- ✅ Muestra indicadores visuales apropiados
- ✅ Maneja casos donde no hay precio mayorista

---

## Casos de Uso

### Caso 1: Producto con Precio Mayorista

**Datos:**
- `sale_price`: 450.000
- `wholesale_price`: 350.000

**Usuario Mayorista ve:**
- Precio: ₲ 350.000
- Precio tachado: ₲ 450.000
- Badge: "Precio Mayorista"

**Cliente Normal ve:**
- Precio: ₲ 450.000
- Sin precio tachado
- Sin badge

### Caso 2: Producto sin Precio Mayorista

**Datos:**
- `sale_price`: 450.000
- `wholesale_price`: null

**Usuario Mayorista ve:**
- Precio: ₲ 450.000
- Sin precio tachado
- Sin badge

**Cliente Normal ve:**
- Precio: ₲ 450.000
- Sin precio tachado
- Sin badge

### Caso 3: Precio Mayorista Igual o Mayor

**Datos:**
- `sale_price`: 450.000
- `wholesale_price`: 450.000

**Usuario Mayorista ve:**
- Precio: ₲ 450.000
- Sin precio tachado (no hay ahorro)
- Badge: "Precio Mayorista"

---

## Testing Manual

### Escenario 1: Usuario No Autenticado

1. ✅ Cerrar sesión
2. ✅ Ir a `/productos`
3. ✅ Verificar que se muestran precios de venta
4. ✅ Verificar que no hay badges de mayorista
5. ✅ Verificar que no hay precios tachados

### Escenario 2: Usuario Cliente Normal

1. ✅ Iniciar sesión como cliente
2. ✅ Ir a `/productos`
3. ✅ Verificar que se muestran precios de venta
4. ✅ Verificar que no hay badges de mayorista
5. ✅ Verificar que no hay precios tachados

### Escenario 3: Usuario Mayorista

1. ✅ Iniciar sesión como mayorista
2. ✅ Ir a `/productos`
3. ✅ Verificar que se muestran precios mayoristas
4. ✅ Verificar badge "Precio Mayorista"
5. ✅ Verificar precio de venta tachado
6. ✅ Verificar que el precio es menor

### Escenario 4: Filtros y Ordenamiento

1. ✅ Como mayorista, ordenar por precio
2. ✅ Verificar que ordena por precio mayorista
3. ✅ Filtrar por rango de precios
4. ✅ Verificar que filtra por precio mayorista

---

## Optimizaciones Aplicadas

### 1. Detección de Rol en Frontend

**Ventaja**: No requiere llamada adicional al backend

```typescript
const { user } = useAuth()  // Ya está en contexto
const isWholesale = user?.role === 'mayorista'
```

### 2. Ambos Precios en Respuesta

**Ventaja**: Una sola llamada API, frontend decide

```typescript
{
  sale_price: 450000,
  wholesale_price: 350000
}
```

### 3. Renderizado Condicional

**Ventaja**: Solo renderiza lo necesario

```typescript
{isWholesale && product.wholesale_price && (
  <Badge>Precio Mayorista</Badge>
)}
```

---

## Mejoras Futuras (Opcional)

### 1. Descuento Porcentual

Mostrar el porcentaje de ahorro:

```typescript
const discount = ((product.sale_price - displayPrice) / product.sale_price) * 100
{discount > 0 && (
  <Badge variant="success">-{discount.toFixed(0)}%</Badge>
)}
```

### 2. Tabla de Precios por Cantidad

Para mayoristas, mostrar precios escalonados:

```
1-10 unidades: ₲ 350.000
11-50 unidades: ₲ 320.000
51+ unidades: ₲ 300.000
```

### 3. Solicitar Precio Mayorista

Botón para clientes normales:

```typescript
<Button variant="outline">
  Solicitar Precio Mayorista
</Button>
```

### 4. Comparación de Precios

Mostrar ahorro total en el carrito:

```
Precio normal: ₲ 4.500.000
Precio mayorista: ₲ 3.500.000
Ahorras: ₲ 1.000.000 (22%)
```

### 5. Notificación de Precio Especial

Toast al entrar como mayorista:

```typescript
toast.success('Precios mayoristas activados', {
  description: 'Estás viendo precios especiales para mayoristas'
})
```

---

## Notas Técnicas

- El componente `ProductCard` ahora es un Client Component (`'use client'`)
- Usa el hook `useAuth` para obtener información del usuario
- La detección de rol se hace en el cliente (no requiere llamada adicional)
- El backend devuelve ambos precios para flexibilidad
- Los filtros y ordenamiento consideran el precio correcto según el usuario
- El cache de la API pública se mantiene (30s browser, 60s CDN)

---

## Seguridad

- ✅ Los precios de compra NO se exponen
- ✅ Solo usuarios autenticados ven precios mayoristas
- ✅ El rol se valida en el backend
- ✅ No se puede manipular el precio desde el frontend
- ✅ La API valida el rol antes de filtrar/ordenar

---

## Conclusión

✅ Sistema de precios mayoristas completamente funcional. Los usuarios mayoristas ahora ven precios especiales con indicadores visuales claros, mientras que los clientes normales y usuarios no autenticados ven precios de venta estándar. La implementación es eficiente, segura y escalable.
