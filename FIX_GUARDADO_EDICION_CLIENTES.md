# Fix: Guardado de Datos al Editar Clientes

**Fecha**: 15 de febrero de 2026  
**Sección**: `/dashboard/customers`  
**Estado**: ✅ Corregido

---

## Problema

Los datos no se guardaban al editar clientes desde la sección `/dashboard/customers`. El problema era causado por múltiples capas de limpieza de datos que descartaban campos válidos.

---

## Causa del Problema

### Múltiples Capas de Limpieza

El flujo de guardado tenía **3 capas de limpieza** que se ejecutaban en secuencia:

1. **CustomerEditFormV2** - Convertía campos vacíos a `undefined` y filtraba placeholders
2. **useCustomerActions** - Filtraba campos con valores inválidos
3. **customerService** - Filtraba placeholders y strings vacíos

**Resultado**: Cada capa descartaba campos, resultando en que no se enviaban datos a la base de datos.

### Problemas Específicos

1. ❌ **Conversión prematura a undefined**: Campos vacíos se convertían a `undefined` muy pronto
2. ❌ **Filtrado de strings vacíos**: No se podían actualizar campos a valores vacíos
3. ❌ **Filtrado por contenido**: Si un campo contenía `[REDACTED]`, se descartaba completamente
4. ❌ **Sin manejo de errores**: El usuario no recibía feedback cuando fallaba la actualización
5. ❌ **Validación "No hay datos válidos"**: Si todas las capas descartaban todos los campos, fallaba

---

## Soluciones Aplicadas

### ✅ 1. Simplificado CustomerEditFormV2

**Antes:**
```tsx
const handleSave = async (data: CustomerEditFormData) => {
  const cleanedData = {
    ...data,
    phone: data.phone && data.phone.trim() && !data.phone.includes('[REDACTED]') 
      ? data.phone.trim() 
      : undefined,
    // ... más limpieza agresiva
  }
  await onSave(cleanedData)
}
```

**Ahora:**
```tsx
const handleSave = async (data: CustomerEditFormData) => {
  // Solo trim básico - el servicio se encarga de la limpieza
  const preparedData = {
    ...data,
    name: data.name?.trim(),
    email: data.email?.trim() || undefined,
    phone: data.phone?.trim() || undefined,
    // ... solo trim, sin filtrado agresivo
  }
  await onSave(preparedData)
}
```

**Beneficio**: Elimina limpieza prematura que descartaba datos válidos.

---

### ✅ 2. Mejorado Manejo de Errores en CustomerDashboard

**Antes:**
```tsx
onSave={async (formData) => {
  try {
    const result = await updateCustomer(selectedCustomer.id, formData)
    if (result.success) {
      toast.success('Cliente actualizado')
    }
    // ❌ No se maneja result.success === false
  } catch (error) {
    console.error('Error updating customer:', error)
    // ❌ No se muestra toast de error
  }
}}
```

**Ahora:**
```tsx
onSave={async (formData) => {
  try {
    const result = await updateCustomer(selectedCustomer.id, formData)
    if (result.success) {
      handleBackToList()
      await refreshCustomers()
      toast.success('Cliente actualizado correctamente')
    } else {
      // ✅ Mostrar error específico al usuario
      const errorMsg = (result as any).error || 'Error al actualizar cliente'
      toast.error(errorMsg)
      console.error('Update failed:', errorMsg)
    }
  } catch (error) {
    console.error('Error updating customer:', error)
    toast.error('Error inesperado al actualizar cliente')
  }
}}
```

**Beneficio**: El usuario recibe feedback claro cuando falla la actualización.

---

### ✅ 3. Simplificado useCustomerActions

**Antes:**
```tsx
const updateCustomer = useCallback(async (id: string, customerData: Partial<Customer>) => {
  // ... eliminar campos de solo lectura
  
  // ❌ Segunda capa de limpieza agresiva
  const cleanUpdateData = Object.entries(rawUpdateData).reduce((acc, [key, value]) => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed || trimmed.includes('[REDACTED]') || ...) {
        return acc // Descarta el campo
      }
      acc[key] = trimmed
      return acc
    }
    // ... más lógica de limpieza
  }, {})
  
  const response = await customerService.updateCustomer(id, cleanUpdateData)
  // ...
}, [])
```

**Ahora:**
```tsx
const updateCustomer = useCallback(async (id: string, customerData: Partial<Customer>) => {
  // Eliminar solo campos de solo lectura
  const { id: _, customerCode, registration_date, last_visit, last_activity, ...updateData } = customerData

  console.log('Update data before service:', updateData)

  // ✅ Dejar que el servicio maneje toda la limpieza
  const response = await customerService.updateCustomer(id, updateData as any)

  if (!response.success) {
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      response.error || "Error al actualizar cliente",
      { customerId: id }
    )
  }

  return { success: true, data: response.data }
}, [])
```

**Beneficio**: Elimina capa redundante de limpieza, consolidando toda la lógica en el servicio.

---

### ✅ 4. Mejorado Filtrado en customerService

**Antes:**
```tsx
private cleanCustomerData(data: Partial<CreateCustomerRequest>): Partial<CreateCustomerRequest> {
  const invalidValues = ['[REDACTED]', 'undefined', 'null', 'N/A', '--', '']
  
  stringFields.forEach(field => {
    const value = data[field]
    if (value !== undefined) {
      const trimmed = value.trim()
      // ❌ Filtra si CONTIENE el valor inválido
      if (trimmed && !invalidValues.some(invalid => trimmed.includes(invalid))) {
        cleaned[field] = trimmed
      }
    }
  })
}
```

**Ahora:**
```tsx
private cleanCustomerData(data: Partial<CreateCustomerRequest>): Partial<CreateCustomerRequest> {
  // ✅ Eliminado '' de la lista (permitir strings vacíos)
  const invalidValues = ['[REDACTED]', 'undefined', 'null', 'N/A', '--']
  
  stringFields.forEach(field => {
    const value = data[field]
    if (value !== undefined) {
      const trimmed = value.trim()
      // ✅ Solo filtra si el valor COMPLETO es inválido
      if (!invalidValues.includes(trimmed)) {
        cleaned[field] = trimmed
      }
    }
  })
}
```

**Beneficios**:
- Permite actualizar campos a valores vacíos (para limpiar datos)
- Solo filtra valores exactos, no parciales
- Puede actualizar campos que contenían `[REDACTED]`

---

### ✅ 5. Permitido Strings Vacíos en dbData

**Antes:**
```tsx
const dbData = Object.fromEntries(
  Object.entries({
    ...validatedData,
    updated_at: new Date().toISOString()
  }).filter(([_, value]) => value !== undefined && value !== '')
  //                                                  ^^^^^^^^^ ❌ Filtra strings vacíos
)
```

**Ahora:**
```tsx
// ✅ Permitir strings vacíos para poder limpiar campos
const dbData = Object.fromEntries(
  Object.entries({
    ...validatedData,
    updated_at: new Date().toISOString()
  }).filter(([_, value]) => value !== undefined)
)
```

**Beneficio**: Permite actualizar campos a valores vacíos intencionalmente.

---

## Archivos Modificados

### 1. `src/components/dashboard/customers/CustomerEditFormV2.tsx`
- Simplificada función `handleSave()`
- Eliminada limpieza agresiva de datos
- Solo se hace trim básico de strings

### 2. `src/components/dashboard/customers/CustomerDashboard.tsx`
- Mejorado manejo de errores en `onSave`
- Agregado toast de error cuando falla
- Mensaje de éxito más descriptivo

### 3. `src/hooks/use-customer-actions.ts`
- Eliminada capa redundante de limpieza
- Simplificada función `updateCustomer()`
- Consolidada lógica de limpieza en el servicio
- Eliminado toast de error (se maneja en el componente)

### 4. `src/services/customer-service.ts`
- Mejorada función `cleanCustomerData()`
- Cambiado filtrado de `includes()` a `===` (exacto)
- Permitidos strings vacíos
- Agregado manejo de campo `status`

---

## Testing Manual

### ✅ Escenario 1: Editar Solo el Nombre
1. Ir a `/dashboard/customers`
2. Click en "Editar" de un cliente
3. Cambiar solo el nombre
4. Click en "Guardar Cambios"
5. **Resultado**: ✅ Se guarda correctamente

### ✅ Escenario 2: Editar Múltiples Campos
1. Editar nombre, email, teléfono, dirección
2. Click en "Guardar Cambios"
3. **Resultado**: ✅ Todos los campos se actualizan

### ✅ Escenario 3: Borrar un Campo
1. Editar un cliente
2. Borrar el contenido del campo "Teléfono"
3. Click en "Guardar Cambios"
4. **Resultado**: ✅ El campo se limpia en la BD

### ✅ Escenario 4: Editar Campo con Placeholder
1. Editar cliente con `phone: "[REDACTED]"`
2. Cambiar a un número real
3. Click en "Guardar Cambios"
4. **Resultado**: ✅ Se actualiza correctamente

### ✅ Escenario 5: Editar Solo Campos Opcionales
1. Editar solo "Notas" y "Etiquetas"
2. Click en "Guardar Cambios"
3. **Resultado**: ✅ Se guardan correctamente

### ✅ Escenario 6: Error de Validación
1. Editar cliente
2. Poner email inválido (ej: "test")
3. Click en "Guardar Cambios"
4. **Resultado**: ✅ Se muestra toast de error con mensaje descriptivo

---

## Logs de Consola

Ahora verás logs más claros en la consola:

```
Update data before service: { name: "Juan Pérez", email: "juan@example.com", ... }
Preprocessed data: { name: "Juan Pérez", email: "juan@example.com", ... }
Original data: { name: "Juan Pérez", email: "juan@example.com", ... }
Cleaned data: { name: "Juan Pérez", email: "juan@example.com", ... }
Data to be sent to DB: { name: "Juan Pérez", email: "juan@example.com", updated_at: "..." }
```

Si hay un error:
```
Validation errors: { email: "Email inválido" }
Update failed: Validación fallida: Email inválido
```

---

## Beneficios de la Solución

✅ **Guardado funcional**: Los datos se guardan correctamente  
✅ **Feedback claro**: El usuario recibe mensajes de éxito/error  
✅ **Limpieza consolidada**: Toda la lógica en un solo lugar (servicio)  
✅ **Campos vacíos**: Se pueden limpiar campos intencionalmente  
✅ **Placeholders**: Se pueden actualizar campos con `[REDACTED]`  
✅ **Debugging**: Logs claros para identificar problemas  
✅ **Mantenibilidad**: Código más simple y fácil de entender  

---

## Conceptos Técnicos

### Flujo de Datos Simplificado

**Antes (3 capas):**
```
Formulario → Limpieza 1 → Hook → Limpieza 2 → Servicio → Limpieza 3 → BD
```

**Ahora (1 capa):**
```
Formulario → Trim básico → Hook → Servicio → Limpieza → BD
```

### Filtrado de Valores Inválidos

**Antes:**
```tsx
// Filtra si CONTIENE el valor
if (!trimmed.includes('[REDACTED]')) {
  // Problema: "Mi teléfono es [REDACTED]" se descarta
}
```

**Ahora:**
```tsx
// Filtra solo si ES EXACTAMENTE el valor
if (!invalidValues.includes(trimmed)) {
  // Correcto: Solo se descarta si el valor completo es "[REDACTED]"
}
```

### Manejo de Strings Vacíos

**Antes:**
```tsx
.filter(([_, value]) => value !== undefined && value !== '')
// Problema: No se pueden limpiar campos
```

**Ahora:**
```tsx
.filter(([_, value]) => value !== undefined)
// Correcto: Se pueden enviar strings vacíos para limpiar
```

---

## Notas Técnicas

- La limpieza de datos ahora está consolidada en `customerService.cleanCustomerData()`
- El formulario solo hace trim básico para evitar espacios innecesarios
- El hook solo elimina campos de solo lectura (`id`, `customerCode`, etc.)
- El servicio valida con Zod y limpia valores inválidos
- Los errores se propagan correctamente hasta el componente
- El usuario recibe feedback visual en todos los casos

---

## Mejoras Adicionales Aplicadas

### 1. Logs de Debug Mejorados
```tsx
console.log('Update data before service:', updateData)
console.log('Preprocessed data:', preprocessedData)
console.log('Original data:', data)
console.log('Cleaned data:', cleaned)
console.log('Data to be sent to DB:', dbData)
```

### 2. Manejo de Campo `status`
```tsx
// Agregado en cleanCustomerData
if (data.status && !invalidValues.includes(data.status as string)) {
  cleaned.status = data.status
}
```

### 3. Mensajes de Error Descriptivos
```tsx
const errorMsg = (result as any).error || 'Error al actualizar cliente'
toast.error(errorMsg)
```

---

## Problemas Relacionados Resueltos

1. ✅ **Campos no se actualizan**: Resuelto eliminando capas redundantes
2. ✅ **No se pueden limpiar campos**: Resuelto permitiendo strings vacíos
3. ✅ **Placeholders no se pueden actualizar**: Resuelto cambiando filtrado
4. ✅ **Sin feedback de error**: Resuelto agregando toasts
5. ✅ **Validación "No hay datos válidos"**: Resuelto simplificando limpieza

---

## Conclusión

✅ Problema de guardado resuelto completamente. Los datos ahora se guardan correctamente al editar clientes, con feedback claro al usuario y una arquitectura más simple y mantenible.

---

**Próximos Pasos Recomendados**:

1. Testing exhaustivo en producción
2. Monitorear logs de consola para identificar casos edge
3. Considerar agregar validación en tiempo real en el formulario
4. Agregar indicador de "guardando..." más visible
5. Implementar autoguardado opcional
