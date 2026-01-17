# 🧪 Guía de Prueba - Sincronización de Crédito

## Objetivo
Verificar que el sistema de crédito muestre los mismos valores en POS y Customers.

## Pre-requisitos
- ✅ Tener al menos un cliente con crédito configurado
- ✅ Tener al menos una venta a crédito registrada
- ✅ Supabase configurado y funcionando

## 📝 Pasos de Prueba

### 1. Verificar Cliente en Customers

1. Ir a **Dashboard → Customers**
2. Seleccionar un cliente que tenga crédito
3. Ver la sección de "Información Crediticia"
4. **Anotar los siguientes valores**:
   ```
   Límite de crédito:    _____________
   Crédito usado:        _____________
   Crédito disponible:   _____________
   Utilización:          _____________
   Créditos activos:     _____________
   Total pagado:         _____________
   ```

### 2. Verificar Mismo Cliente en POS

1. Ir a **Dashboard → POS**
2. Agregar productos al carrito
3. Hacer clic en "Procesar Pago"
4. Seleccionar el **mismo cliente** del paso 1
5. Hacer clic en el botón de método de pago **"Crédito"**
6. **Anotar los siguientes valores**:
   ```
   Límite de crédito:    _____________
   Crédito usado:        _____________
   Crédito disponible:   _____________
   Utilización:          _____________
   ```

### 3. Comparar Valores

| Campo | Customers | POS | ¿Coinciden? |
|-------|-----------|-----|-------------|
| Límite de crédito | | | ☐ |
| Crédito usado | | | ☐ |
| Crédito disponible | | | ☐ |
| Utilización (%) | | | ☐ |

**Resultado esperado**: ✅ Todos los valores deben coincidir exactamente

### 4. Probar Validación de Límite

#### Caso A: Cliente con crédito suficiente

1. En POS, agregar productos por un monto **menor** al crédito disponible
2. Seleccionar método de pago "Crédito"
3. **Resultado esperado**: 
   - ✅ Botón "Crédito" habilitado
   - ✅ Muestra crédito disponible en verde
   - ✅ Muestra cálculo del nuevo saldo

#### Caso B: Cliente con crédito insuficiente

1. En POS, agregar productos por un monto **mayor** al crédito disponible
2. Seleccionar método de pago "Crédito"
3. **Resultado esperado**:
   - ✅ Botón "Crédito" deshabilitado
   - ✅ Muestra mensaje "Crédito insuficiente"
   - ✅ Muestra el faltante en rojo

#### Caso C: Cliente sin crédito configurado

1. En POS, seleccionar un cliente con `credit_limit = 0` o `null`
2. Intentar seleccionar método de pago "Crédito"
3. **Resultado esperado**:
   - ✅ Botón "Crédito" deshabilitado
   - ✅ Muestra "Sin configurar"
   - ✅ Muestra mensaje "Cliente sin crédito configurado"

### 5. Probar Creación de Venta a Crédito

1. Seleccionar cliente con crédito suficiente
2. Agregar productos al carrito
3. Procesar pago con método "Crédito"
4. **Verificar en Customers**:
   - ☐ El crédito usado aumentó
   - ☐ El crédito disponible disminuyó
   - ☐ Aparece nuevo crédito en la lista
   - ☐ Se crearon las cuotas correspondientes

5. **Verificar en POS** (con el mismo cliente):
   - ☐ Los valores se actualizaron
   - ☐ Coinciden con los de Customers

## 🐛 Problemas Comunes

### Problema 1: Valores no coinciden
**Causa**: Caché del navegador o datos no actualizados
**Solución**: 
1. Refrescar la página (F5)
2. Hacer clic en el botón de refresh en la sección de crédito
3. Verificar que Supabase esté funcionando

### Problema 2: No carga datos de crédito
**Causa**: API no responde o error de Supabase
**Solución**:
1. Abrir consola del navegador (F12)
2. Buscar errores en la pestaña "Console"
3. Verificar que `/api/credits/batch` responda correctamente
4. Verificar configuración de Supabase

### Problema 3: Botón "Crédito" siempre deshabilitado
**Causa**: Cliente no tiene `credit_limit` configurado
**Solución**:
1. Ir a Customers
2. Editar el cliente
3. Configurar un límite de crédito (ej: 5,000,000)
4. Guardar cambios
5. Intentar nuevamente en POS

## ✅ Checklist de Validación

- [ ] Valores coinciden entre POS y Customers
- [ ] Validación de límite funciona correctamente
- [ ] Mensaje de error apropiado para cliente sin crédito
- [ ] Mensaje de error apropiado para crédito insuficiente
- [ ] Venta a crédito se crea correctamente
- [ ] Datos se actualizan en ambas secciones
- [ ] No hay errores en la consola
- [ ] UI muestra información clara y precisa

## 📊 Casos de Prueba Detallados

### Caso 1: Cliente Nuevo (Sin Historial)
```
Límite de crédito: 5,000,000
Crédito usado: 0
Crédito disponible: 5,000,000
Utilización: 0%
```
**Acción**: Vender 1,000,000 a crédito
**Resultado esperado**:
```
Límite de crédito: 5,000,000
Crédito usado: 1,000,000
Crédito disponible: 4,000,000
Utilización: 20%
```

### Caso 2: Cliente con Crédito Parcial
```
Límite de crédito: 5,000,000
Crédito usado: 3,000,000
Crédito disponible: 2,000,000
Utilización: 60%
```
**Acción**: Intentar vender 2,500,000 a crédito
**Resultado esperado**: ❌ Rechazado (insuficiente)

**Acción**: Vender 1,500,000 a crédito
**Resultado esperado**: ✅ Aprobado
```
Límite de crédito: 5,000,000
Crédito usado: 4,500,000
Crédito disponible: 500,000
Utilización: 90%
```

### Caso 3: Cliente al Límite
```
Límite de crédito: 5,000,000
Crédito usado: 5,000,000
Crédito disponible: 0
Utilización: 100%
```
**Acción**: Intentar cualquier venta a crédito
**Resultado esperado**: ❌ Rechazado (sin crédito disponible)

## 🎯 Criterios de Éxito

La sincronización es exitosa si:

1. ✅ **Consistencia**: Valores idénticos en POS y Customers
2. ✅ **Precisión**: Cálculos correctos basados en cuotas reales
3. ✅ **Validación**: Límites respetados correctamente
4. ✅ **Mensajes**: Errores claros y específicos
5. ✅ **Actualización**: Cambios reflejados en tiempo real
6. ✅ **Performance**: Carga rápida sin delays notables

## 📸 Capturas Recomendadas

Para documentar la prueba, tomar capturas de:

1. Sección de crédito en Customers (antes de venta)
2. Modal de checkout en POS mostrando crédito (antes de venta)
3. Confirmación de venta a crédito
4. Sección de crédito en Customers (después de venta)
5. Modal de checkout en POS (después de venta)

---

**Fecha de creación**: 16 de enero de 2026  
**Última actualización**: 16 de enero de 2026  
**Estado**: Listo para pruebas
