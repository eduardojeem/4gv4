# 🔍 Diagnóstico: "Crédito Sin configurar" en POS

## Problema
El POS muestra "Sin configurar" en el botón de crédito incluso después de configurar el sistema.

## ✅ Solución Rápida

### Paso 1: Ver el Panel de Debug
1. Ve a **Dashboard → POS**
2. Agrega productos al carrito
3. Click en **"Procesar Pago"**
4. Selecciona un cliente
5. Verás un **panel azul de debug** que muestra:
   - Datos del cliente
   - Límite de crédito configurado
   - Resumen de crédito
   - Validación

### Paso 2: Interpretar el Debug

#### Caso A: `credit_limit: 0` o `credit_limit: null`
```
Cliente: Juan Pérez
credit_limit: 0          ← PROBLEMA AQUÍ
current_balance: 0

Credit Summary: ❌ creditSummary es null
canUseCredit: ❌ false
⚠️ credit_limit es 0 o null
```

**Solución**: El cliente no tiene límite de crédito configurado

**Opciones**:

1. **Ejecutar script SQL** (Recomendado):
   ```sql
   -- En Supabase SQL Editor
   -- Copia y pega el contenido de:
   supabase/seed-credit-auto.sql
   ```

2. **Configurar manualmente**:
   - Ve a **Dashboard → Customers**
   - Busca el cliente
   - Edita y configura `credit_limit` (ej: 5000000)
   - Guarda cambios

#### Caso B: Cliente con crédito pero no se carga
```
Cliente: Juan Pérez
credit_limit: 5000000    ← Configurado ✓
current_balance: 0

Credit Summary: ❌ creditSummary es null  ← PROBLEMA
canUseCredit: ❌ false
```

**Solución**: Los datos no se están cargando desde Supabase

**Pasos**:
1. Abre la consola del navegador (F12)
2. Ve a la pestaña **Network**
3. Busca llamadas a `/api/credits/batch`
4. Verifica si hay errores

**Posibles causas**:
- Supabase no configurado
- Tablas de crédito no existen
- Error en el API

#### Caso C: Todo configurado correctamente
```
Cliente: Juan Pérez
credit_limit: 5000000
current_balance: 0

Credit Summary:
  Total: 5000000
  Usado: 1500000
  Disponible: 3500000
  Utilización: 30%

canUseCredit: ✅ true
```

**Estado**: ✅ Funcionando correctamente

### Paso 3: Ejecutar Script de Datos de Prueba

Si el problema es `credit_limit: 0`, ejecuta este script:

1. **Abre Supabase SQL Editor**
   - https://supabase.com/dashboard
   - Tu proyecto → SQL Editor → New Query

2. **Copia y pega**:
   ```sql
   -- Archivo: supabase/seed-credit-auto.sql
   -- (Copia TODO el contenido del archivo)
   ```

3. **Ejecuta** (Run o Ctrl+Enter)

4. **Verifica**:
   ```sql
   SELECT 
     name,
     credit_limit,
     current_balance
   FROM customers
   WHERE credit_limit > 0;
   ```

5. **Refresca el POS** (F5)

### Paso 4: Verificar en la Aplicación

1. **En POS**:
   - Selecciona uno de los clientes configurados
   - El panel de debug debe mostrar:
     - `credit_limit > 0`
     - `creditSummary` con datos
     - `canUseCredit: true`

2. **Botón de Crédito**:
   - Debe mostrar el monto disponible
   - Debe estar habilitado (no gris)
   - Al hacer click, debe mostrar detalles

## 🐛 Script de Diagnóstico Avanzado

Si necesitas más información, ejecuta esto en la consola del navegador:

1. Abre **Dashboard → POS**
2. Presiona **F12** (Consola)
3. Copia y pega el contenido de `debug-credit-system.js`
4. Presiona Enter
5. Revisa el reporte completo

## 📋 Checklist de Verificación

- [ ] Panel de debug visible en el modal de checkout
- [ ] Cliente seleccionado tiene `credit_limit > 0`
- [ ] `creditSummary` muestra datos (no es null)
- [ ] `canUseCredit` es `true`
- [ ] Botón de crédito muestra monto disponible
- [ ] Botón de crédito está habilitado
- [ ] Al hacer click muestra detalles del crédito

## 🔧 Problemas Comunes

### "creditSummary es null"
**Causa**: No se están cargando datos desde Supabase  
**Solución**: 
1. Verifica que Supabase esté configurado
2. Verifica que las tablas existan
3. Ejecuta el script de datos de prueba

### "credit_limit es 0"
**Causa**: Cliente no tiene límite configurado  
**Solución**: Ejecuta `supabase/seed-credit-auto.sql`

### "Crédito insuficiente"
**Causa**: Cliente tiene crédito pero ya lo usó todo  
**Solución**: Normal, es la validación funcionando correctamente

## 🎯 Resultado Esperado

Después de seguir estos pasos, deberías ver:

```
🐛 Debug - Sistema de Crédito

Cliente: Juan Pérez
credit_limit: 5000000
current_balance: 0

Credit Summary:
  Total: 5000000
  Usado: 1500000
  Disponible: 3500000
  Utilización: 30%

Validación:
  canUseCredit: ✅ true
```

Y el botón de crédito debe mostrar:
```
💳 Crédito
   ₲3,500,000
   disponible
```

## 🗑️ Remover el Debug

Una vez que funcione correctamente, puedes remover el panel de debug:

1. Abre `src/app/dashboard/pos/components/CheckoutModal.tsx`
2. Busca y elimina estas líneas:
   ```tsx
   {/* DEBUG: Componente temporal para diagnosticar */}
   <div className="mt-4">
     <CreditDebugInline 
       activeCustomer={activeCustomer}
       creditSummary={creditSummary}
       canUseCredit={canUseCredit}
     />
   </div>
   ```
3. Guarda el archivo

---

**Archivos relacionados**:
- `debug-credit-system.js` - Script de diagnóstico para consola
- `supabase/seed-credit-auto.sql` - Script de datos de prueba
- `GUIA_CREAR_DATOS_PRUEBA_CREDITO.md` - Guía completa
