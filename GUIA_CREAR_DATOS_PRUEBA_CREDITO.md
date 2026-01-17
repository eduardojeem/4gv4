# 🚀 Guía: Crear Datos de Prueba para Sistema de Crédito

## 📋 Objetivo
Crear datos de prueba en Supabase para ver el sistema de crédito funcionando y verificar la sincronización entre POS y Customers.

## ⚡ Método Más Rápido (Recomendado)

### Opción A: Script Automático (1 minuto)

1. **Abre Supabase SQL Editor**
   - Ve a [Supabase Dashboard](https://supabase.com/dashboard)
   - Click en **SQL Editor** → **New Query**

2. **Copia y Pega**
   - Abre el archivo `supabase/seed-credit-auto.sql`
   - Copia TODO el contenido
   - Pégalo en el SQL Editor

3. **Ejecuta**
   - Click en **Run** (o Ctrl+Enter)
   - Espera 5-10 segundos
   - Verás mensajes de confirmación

4. **Listo!** 🎉
   - Los primeros 4 clientes ahora tienen datos de crédito
   - Ve a la aplicación para verlos

### Opción B: Script Manual (5 minutos)

Si prefieres elegir clientes específicos, sigue estos pasos:

### Paso 1: Abrir Supabase SQL Editor
1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Click en **SQL Editor** en el menú lateral
3. Click en **New Query**

### Paso 2: Obtener IDs de Clientes
Copia y pega este código, luego ejecuta (Run):

```sql
SELECT id, name, email FROM customers LIMIT 10;
```

**Copia 4 IDs** de clientes que quieras usar para las pruebas.

### Paso 3: Ejecutar Script Completo
Copia el contenido del archivo `supabase/seed-credit-simple.sql` y:

1. **Reemplaza** todos los `'TU_CUSTOMER_ID_X'` con los IDs reales que copiaste
2. **Ejecuta** el script completo (Run)
3. Verifica que no haya errores

### Paso 4: Verificar Datos
Ejecuta esta consulta para ver el resumen:

```sql
SELECT 
  c.name,
  c.credit_limit as limite,
  COUNT(DISTINCT cc.id) as creditos,
  SUM(CASE WHEN ci.status IN ('pending', 'late') THEN ci.amount ELSE 0 END) as usado,
  c.credit_limit - SUM(CASE WHEN ci.status IN ('pending', 'late') THEN ci.amount ELSE 0 END) as disponible
FROM customers c
LEFT JOIN customer_credits cc ON cc.customer_id = c.id AND cc.status = 'active'
LEFT JOIN credit_installments ci ON ci.credit_id = cc.id
WHERE c.credit_limit > 0
GROUP BY c.id, c.name, c.credit_limit
ORDER BY c.name;
```

## 📊 Datos que se Crearán

### Cliente 1: Con Historial de Pagos
```
Límite de crédito: ₲5,000,000
Crédito usado: ₲1,500,000 (9 cuotas pendientes)
Crédito disponible: ₲3,500,000
Utilización: 30%
Estado: 3 cuotas pagadas, 1 vencida, 8 pendientes
```

### Cliente 2: Buen Pagador
```
Límite de crédito: ₲10,000,000
Crédito usado: ₲2,500,000 (10 cuotas pendientes)
Crédito disponible: ₲7,500,000
Utilización: 25%
Estado: 2 cuotas pagadas, 10 pendientes
```

### Cliente 3: Sin Crédito
```
Límite de crédito: ₲0
Estado: Sin crédito configurado
```

### Cliente 4: Al Límite
```
Límite de crédito: ₲3,000,000
Crédito usado: ₲3,000,000 (12 cuotas pendientes)
Crédito disponible: ₲0
Utilización: 100%
Estado: Sin pagos realizados
```

## ✅ Verificar en la Aplicación

### En Customers:
1. Ve a **Dashboard → Customers**
2. Busca los clientes que configuraste
3. Haz click en cada uno
4. Verifica que veas:
   - Información crediticia completa
   - Créditos activos
   - Cuotas pendientes
   - Historial de pagos

### En POS:
1. Ve a **Dashboard → POS**
2. Agrega productos al carrito
3. Click en **Procesar Pago**
4. Selecciona cada cliente de prueba
5. Click en método de pago **"Crédito"**
6. Verifica que veas:
   - Los mismos valores que en Customers
   - Validación correcta (habilitado/deshabilitado)
   - Mensajes apropiados

## 🧪 Casos de Prueba

### Caso 1: Cliente con Crédito Suficiente
**Cliente**: Cliente 1 o Cliente 2  
**Acción**: Vender ₲1,000,000 a crédito  
**Resultado esperado**: ✅ Venta aprobada

### Caso 2: Cliente con Crédito Insuficiente
**Cliente**: Cliente 1  
**Acción**: Intentar vender ₲4,000,000 a crédito  
**Resultado esperado**: ❌ Rechazado con mensaje "Crédito insuficiente"

### Caso 3: Cliente sin Crédito
**Cliente**: Cliente 3  
**Acción**: Intentar vender cualquier monto a crédito  
**Resultado esperado**: ❌ Rechazado con mensaje "Cliente sin crédito configurado"

### Caso 4: Cliente al Límite
**Cliente**: Cliente 4  
**Acción**: Intentar vender cualquier monto a crédito  
**Resultado esperado**: ❌ Rechazado (crédito disponible = 0)

## 🔍 Comparar Valores

Usa esta tabla para verificar que los valores coincidan:

| Cliente | Sección | Límite | Usado | Disponible | ¿Coincide? |
|---------|---------|--------|-------|------------|------------|
| Cliente 1 | Customers | | | | ☐ |
| Cliente 1 | POS | | | | ☐ |
| Cliente 2 | Customers | | | | ☐ |
| Cliente 2 | POS | | | | ☐ |

**Resultado esperado**: ✅ Todos los valores deben ser idénticos

## 🐛 Solución de Problemas

### Error: "relation customer_credits does not exist"
**Causa**: Las tablas de crédito no existen  
**Solución**: Ejecuta las migraciones de Supabase primero

### Error: "invalid input syntax for type uuid"
**Causa**: No reemplazaste los IDs de ejemplo  
**Solución**: Asegúrate de reemplazar TODOS los `'TU_CUSTOMER_ID_X'` con IDs reales

### No veo datos en POS
**Causa**: Los datos no se están cargando  
**Solución**: 
1. Abre la consola del navegador (F12)
2. Ve a la pestaña Network
3. Busca la llamada a `/api/credits/batch`
4. Verifica que responda con datos

### Valores no coinciden
**Causa**: Caché o datos no actualizados  
**Solución**: Refresca la página (F5) en ambas secciones

## 🧹 Limpiar Datos de Prueba

Si necesitas empezar de nuevo, ejecuta:

```sql
-- CUIDADO: Esto borra TODOS los datos de crédito
DELETE FROM credit_payments;
DELETE FROM credit_installments;
DELETE FROM customer_credits;
UPDATE customers SET credit_limit = 0, current_balance = 0;
```

## 📸 Capturas Recomendadas

Para documentar que funciona correctamente:

1. **Customers - Cliente 1**: Captura mostrando información de crédito
2. **POS - Cliente 1**: Captura del modal de checkout con crédito
3. **Comparación**: Ambas capturas lado a lado mostrando valores idénticos

## 🎯 Checklist Final

- [ ] Script ejecutado sin errores
- [ ] 4 clientes configurados con diferentes escenarios
- [ ] Datos visibles en sección Customers
- [ ] Datos visibles en sección POS
- [ ] Valores coinciden entre ambas secciones
- [ ] Validaciones funcionan correctamente
- [ ] Mensajes de error apropiados

## 📞 Siguiente Paso

Una vez que tengas los datos de prueba:

1. Abre **Dashboard → Customers**
2. Abre **Dashboard → POS** en otra pestaña
3. Compara los valores del mismo cliente en ambas secciones
4. Confirma que son idénticos ✅

---

**Archivos relacionados**:
- `supabase/seed-credit-simple.sql` - Script simplificado
- `supabase/seed-credit-test-data.sql` - Script detallado
- `PRUEBA_SINCRONIZACION_CREDITO.md` - Guía de pruebas completa
