# Diagnóstico: No se Guardan Datos al Editar Clientes

**Fecha**: 15 de febrero de 2026  
**Sección**: `/dashboard/customers`  
**Estado**: 🔍 En Investigación

---

## Problema Reportado

Los datos no se guardan al editar clientes desde la sección `/dashboard/customers`.

---

## Flujo de Guardado Actual

### 1. Usuario Edita Cliente
```
CustomerDashboard → handleEditCustomer() → setCurrentView('edit')
```

### 2. Formulario de Edición
```tsx
// src/components/dashboard/customers/CustomerDashboard.tsx (línea 835-852)
{currentView === 'edit' && selectedCustomer && (
  <CustomerEditFormV2
    customer={selectedCustomer}
    onSave={async (formData) => {
      try {
        const result = await updateCustomer(selectedCustomer.id, formData)
        if (result.success) {
          handleBackToList()
          await refreshCustomers()
          toast.success('Cliente actualizado')
        }
      } catch (error) {
        console.error('Error updating customer:', error)
      }
    }}
    onCancel={handleBackToList}
  />
)}
```

### 3. CustomerEditFormV2 - Limpieza de Datos
```tsx
// src/components/dashboard/customers/CustomerEditFormV2.tsx (línea 165-185)
const handleSave = async (data: CustomerEditFormData) => {
  setIsSaving(true)
  try {
    const cleanedData = {
      ...data,
      // ⚠️ PROBLEMA: Convierte campos vacíos a undefined
      phone: data.phone && data.phone.trim() && !data.phone.includes('[REDACTED]') 
        ? data.phone.trim() 
        : undefined,
      whatsapp: data.whatsapp && data.whatsapp.trim() && !data.whatsapp.includes('[REDACTED]') 
        ? data.whatsapp.trim() 
        : undefined,
      // ... más campos convertidos a undefined
    }
    await onSave(cleanedData)
    setHasChanges(false)
  } catch (error) {
    console.error('Error saving customer:', error)
    toast.error('Error al actualizar cliente')
  } finally {
    setIsSaving(false)
  }
}
```

### 4. useCustomerActions - Segunda Limpieza
```tsx
// src/hooks/use-customer-actions.ts (línea 156-220)
const updateCustomer = useCallback(async (id: string, customerData: Partial<Customer>) => {
  return withRetry(async () => {
    try {
      const { id: _, customerCode, registration_date, last_visit, last_activity, ...rawUpdateData } = customerData

      // ⚠️ PROBLEMA: Segunda capa de limpieza
      const cleanUpdateData = Object.entries(rawUpdateData).reduce((acc, [key, value]) => {
        if (typeof value === 'string') {
          const trimmed = value.trim()
          if (!trimmed || trimmed.includes('[REDACTED]') || trimmed === 'undefined' || ...) {
            return acc // ⚠️ Descarta el campo
          }
          acc[key] = trimmed
          return acc
        }
        // ... más lógica de limpieza
      }, {} as Record<string, any>)

      const response = await customerService.updateCustomer(id, cleanUpdateData as any)
      // ...
    }
  })
}, [])
```

### 5. customerService - Tercera Limpieza
```tsx
// src/services/customer-service.ts (línea 224-350)
async updateCustomer(id: string | number, customerData: Partial<CreateCustomerRequest>): Promise<CustomerResponse> {
  try {
    // Pre-process data
    const preprocessedData = preprocessCustomerData(customerData)
    console.log('Preprocessed data:', preprocessedData)

    // ⚠️ PROBLEMA: Tercera capa de limpieza
    const cleanedData = this.cleanCustomerData(preprocessedData)
    console.log('Final cleaned data:', cleanedData)

    // ⚠️ PROBLEMA: Si no hay datos válidos, falla
    if (Object.keys(cleanedData).length === 0) {
      return {
        success: false,
        error: 'No hay datos válidos para actualizar'
      }
    }

    // Validación con Zod
    const validation = validateCustomerData(updateCustomerSchema, cleanedData)
    
    if (!validation.success) {
      const errors = getValidationErrors((validation as any).errors)
      const errorMessage = Object.values(errors).join(', ')
      console.error('Validation errors:', errors)
      return {
        success: false,
        error: `Validación fallida: ${errorMessage}`
      }
    }

    // Filtrar undefined antes de enviar a DB
    const dbData = Object.fromEntries(
      Object.entries({
        ...validatedData,
        updated_at: new Date().toISOString()
      }).filter(([_, value]) => value !== undefined && value !== '')
    )

    console.log('Data to be sent to DB:', dbData)

    // Actualizar en Supabase
    const { data: updatedRow, error: updateError } = await this.supabase
      .from('customers')
      .update(dbData)
      .eq('id', queryId)
      .select('*')
      .maybeSingle()
    // ...
  }
}
```

### 6. cleanCustomerData - Filtrado Agresivo
```tsx
// src/services/customer-service.ts (línea 367-425)
private cleanCustomerData(data: Partial<CreateCustomerRequest>): Partial<CreateCustomerRequest> {
  const cleaned: Partial<CreateCustomerRequest> = {}
  
  // ⚠️ PROBLEMA: Lista de valores inválidos muy amplia
  const invalidValues = ['[REDACTED]', 'undefined', 'null', 'N/A', '--', '']

  const stringFields = ['name', 'email', 'phone', 'whatsapp', 'address', 'city', ...]
  
  stringFields.forEach(field => {
    const value = data[field as keyof CreateCustomerRequest] as string
    if (value !== undefined) {
      const trimmed = value.trim()
      // ⚠️ PROBLEMA: Filtra campos vacíos y con placeholders
      if (trimmed && !invalidValues.some(invalid => trimmed.includes(invalid))) {
        cleaned[field as keyof CreateCustomerRequest] = trimmed as any
      }
    }
  })
  
  // ... más lógica de limpieza
  
  return cleaned
}
```

---

## Problemas Identificados

### 🔴 Problema 1: Múltiples Capas de Limpieza
Hay **3 capas de limpieza** de datos que se ejecutan en secuencia:
1. `CustomerEditFormV2.handleSave()` - Convierte campos vacíos a `undefined`
2. `useCustomerActions.updateCustomer()` - Filtra campos con valores inválidos
3. `customerService.cleanCustomerData()` - Filtra placeholders y strings vacíos

**Impacto**: Cada capa puede descartar campos válidos, resultando en que no se envíen datos a la base de datos.

### 🔴 Problema 2: Conversión Prematura a undefined
```tsx
// CustomerEditFormV2.tsx
phone: data.phone && data.phone.trim() && !data.phone.includes('[REDACTED]') 
  ? data.phone.trim() 
  : undefined  // ⚠️ Convierte a undefined muy pronto
```

**Impacto**: Si el usuario borra un campo (para dejarlo vacío intencionalmente), se convierte a `undefined` y luego se descarta en las siguientes capas.

### 🔴 Problema 3: Validación de "No hay datos válidos"
```tsx
if (Object.keys(cleanedData).length === 0) {
  return {
    success: false,
    error: 'No hay datos válidos para actualizar'
  }
}
```

**Impacto**: Si todas las capas de limpieza descartan todos los campos, la actualización falla con este error.

### 🔴 Problema 4: Filtrado de Strings Vacíos
```tsx
.filter(([_, value]) => value !== undefined && value !== '')
```

**Impacto**: No se pueden actualizar campos a valores vacíos (para limpiar datos).

### 🔴 Problema 5: No se Manejan Errores en el Formulario
```tsx
// CustomerDashboard.tsx
onSave={async (formData) => {
  try {
    const result = await updateCustomer(selectedCustomer.id, formData)
    if (result.success) {
      // ✅ Éxito
    }
    // ⚠️ PROBLEMA: No se maneja result.success === false
  } catch (error) {
    console.error('Error updating customer:', error)
    // ⚠️ PROBLEMA: No se muestra toast de error al usuario
  }
}}
```

**Impacto**: Si la actualización falla, el usuario no recibe feedback visual.

---

## Escenarios de Fallo

### Escenario 1: Usuario Edita Solo el Nombre
1. Usuario cambia nombre de "Juan Pérez" a "Juan Pérez García"
2. Otros campos quedan vacíos o con placeholders
3. `CustomerEditFormV2` convierte campos vacíos a `undefined`
4. `useCustomerActions` descarta campos `undefined`
5. `customerService` filtra placeholders
6. **Resultado**: Solo se envía `name` a la BD
7. **Estado**: ✅ Funciona (si `name` pasa todas las validaciones)

### Escenario 2: Usuario Borra un Campo
1. Usuario borra el teléfono (para dejarlo vacío)
2. `CustomerEditFormV2` convierte `phone` a `undefined`
3. `useCustomerActions` descarta `phone` porque es `undefined`
4. **Resultado**: El campo `phone` no se actualiza en la BD
5. **Estado**: ❌ Falla (el campo no se limpia)

### Escenario 3: Usuario Edita Solo Campos Opcionales
1. Usuario edita solo `notes` y `tags`
2. Otros campos quedan con valores existentes o vacíos
3. Múltiples capas de limpieza descartan campos
4. **Resultado**: `cleanedData` queda vacío
5. **Error**: "No hay datos válidos para actualizar"
6. **Estado**: ❌ Falla completamente

### Escenario 4: Usuario Edita Campos con Placeholders
1. Usuario edita cliente con `phone: "[REDACTED]"`
2. Usuario cambia `phone` a un número real
3. `CustomerEditFormV2` verifica `!data.phone.includes('[REDACTED]')`
4. **Resultado**: El campo se descarta porque contiene `[REDACTED]`
5. **Estado**: ❌ Falla (no se puede actualizar desde placeholder)

---

## Logs de Consola Esperados

Si el problema está ocurriendo, deberías ver en la consola:

```
Preprocessed data: { name: "Juan Pérez", ... }
Final cleaned data: {}
Error: No hay datos válidos para actualizar
```

O:

```
Validation errors: { phone: "Teléfono inválido", ... }
Error: Validación fallida: Teléfono inválido
```

---

## Soluciones Propuestas

### ✅ Solución 1: Eliminar Limpieza Redundante en CustomerEditFormV2
**Problema**: El formulario hace limpieza prematura que luego se repite en el hook y servicio.

**Solución**: Dejar que el servicio maneje toda la limpieza.

```tsx
// CustomerEditFormV2.tsx - ANTES
const handleSave = async (data: CustomerEditFormData) => {
  const cleanedData = {
    ...data,
    phone: data.phone && data.phone.trim() && !data.phone.includes('[REDACTED]') 
      ? data.phone.trim() 
      : undefined,
    // ... más limpieza
  }
  await onSave(cleanedData)
}

// CustomerEditFormV2.tsx - DESPUÉS
const handleSave = async (data: CustomerEditFormData) => {
  // Solo enviar los datos tal cual, el servicio se encarga de limpiar
  await onSave(data)
}
```

### ✅ Solución 2: Permitir Actualizar Campos a Vacío
**Problema**: No se pueden limpiar campos (actualizar a vacío).

**Solución**: Distinguir entre "no enviar" y "actualizar a vacío".

```tsx
// customer-service.ts - ANTES
.filter(([_, value]) => value !== undefined && value !== '')

// customer-service.ts - DESPUÉS
.filter(([_, value]) => value !== undefined)
// Permitir strings vacíos para limpiar campos
```

### ✅ Solución 3: Mejorar Manejo de Errores en CustomerDashboard
**Problema**: No se muestra feedback al usuario cuando falla.

**Solución**: Mostrar toast de error.

```tsx
// CustomerDashboard.tsx - DESPUÉS
onSave={async (formData) => {
  try {
    const result = await updateCustomer(selectedCustomer.id, formData)
    if (result.success) {
      handleBackToList()
      await refreshCustomers()
      toast.success('Cliente actualizado')
    } else {
      // ✅ Mostrar error al usuario
      toast.error(result.error || 'Error al actualizar cliente')
    }
  } catch (error) {
    console.error('Error updating customer:', error)
    toast.error('Error inesperado al actualizar cliente')
  }
}}
```

### ✅ Solución 4: Consolidar Limpieza en un Solo Lugar
**Problema**: Tres capas de limpieza causan confusión y bugs.

**Solución**: Mover toda la limpieza al servicio.

```tsx
// useCustomerActions.ts - SIMPLIFICAR
const updateCustomer = useCallback(async (id: string, customerData: Partial<Customer>) => {
  return withRetry(async () => {
    try {
      // Eliminar campos de solo lectura
      const { id: _, customerCode, registration_date, last_visit, last_activity, ...updateData } = customerData

      // ✅ Dejar que el servicio limpie los datos
      const response = await customerService.updateCustomer(id, updateData as any)
      
      if (!response.success) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          response.error || "Error al actualizar cliente",
          { customerId: id }
        )
      }

      return { success: true, data: response.data }
    } catch (error: any) {
      // ... manejo de errores
    }
  })
}, [])
```

### ✅ Solución 5: Mejorar Validación de Placeholders
**Problema**: No se pueden actualizar campos que contienen `[REDACTED]`.

**Solución**: Solo filtrar si el valor COMPLETO es un placeholder, no si lo contiene.

```tsx
// customer-service.ts - ANTES
if (trimmed && !invalidValues.some(invalid => trimmed.includes(invalid))) {
  cleaned[field] = trimmed
}

// customer-service.ts - DESPUÉS
if (trimmed && !invalidValues.includes(trimmed)) {
  cleaned[field] = trimmed
}
```

---

## Plan de Acción

### Paso 1: Verificar Logs de Consola
Abrir la consola del navegador y intentar editar un cliente. Buscar:
- `Preprocessed data:`
- `Final cleaned data:`
- `Data to be sent to DB:`
- Errores de validación

### Paso 2: Aplicar Soluciones
1. ✅ Simplificar `CustomerEditFormV2.handleSave()`
2. ✅ Mejorar manejo de errores en `CustomerDashboard`
3. ✅ Ajustar filtrado de placeholders en `cleanCustomerData()`
4. ✅ Permitir strings vacíos en `dbData`

### Paso 3: Testing
1. Editar solo el nombre
2. Editar múltiples campos
3. Borrar un campo (dejarlo vacío)
4. Editar campo con placeholder `[REDACTED]`
5. Editar solo campos opcionales (notes, tags)

---

## Archivos a Modificar

1. `src/components/dashboard/customers/CustomerEditFormV2.tsx` - Simplificar limpieza
2. `src/components/dashboard/customers/CustomerDashboard.tsx` - Mejorar manejo de errores
3. `src/hooks/use-customer-actions.ts` - Eliminar limpieza redundante
4. `src/services/customer-service.ts` - Ajustar filtrado y permitir vacíos

---

## Próximos Pasos

1. 🔍 Revisar logs de consola para confirmar diagnóstico
2. 🛠️ Aplicar soluciones propuestas
3. ✅ Testing exhaustivo
4. 📝 Documentar cambios

---

**Estado**: Diagnóstico completo, listo para aplicar soluciones.
