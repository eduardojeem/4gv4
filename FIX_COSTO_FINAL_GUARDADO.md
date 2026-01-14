# 🐛 Fix: Costo Final no se guardaba al editar reparaciones

## Problema Identificado

Al editar una reparación, los campos `finalCost` y `laborCost` no se guardaban en la base de datos, aunque se mostraban correctamente en el formulario.

## Causa Raíz

Había **múltiples problemas** en diferentes capas de la aplicación:

### 1. **Inconsistencia en nombres de campos** (`src/app/dashboard/repairs/page.tsx`)
- Se estaban usando nombres de columna de base de datos (`labor_cost`, `final_cost`)
- En lugar de usar los nombres del tipo TypeScript (`laborCost`, `finalCost`)
- El contexto `RepairsContext` espera los nombres TypeScript y hace el mapeo internamente

### 2. **Campos faltantes en `use-repairs.ts`**
- La función `updateRepair` no incluía `labor_cost` ni `final_cost` en el update de Supabase
- Solo actualizaba: brand, model, issue, description, estimatedCost, accessType, accessPassword, technician_id

### 3. **Campos faltantes en `use-technician-board.ts`**
- Similar al problema anterior
- La función `updateRepair` no incluía los campos de costos

## Solución Implementada

### ✅ Archivo 1: `src/app/dashboard/repairs/page.tsx`

**Antes:**
```typescript
const updatePayload = {
  customer_id: data.existingCustomerId,
  device_brand: d.brand,
  device_model: d.model,
  device_type: d.deviceType,
  problem_description: d.issue,
  diagnosis: d.description,
  access_type: d.accessType || 'none',
  access_password: d.accessPassword || null,
  priority: data.priority,
  urgency,
  technician_id: d.technician,
  estimated_cost: d.estimatedCost,
  labor_cost: data.laborCost || 0,  // ❌ Nombre de columna DB
  final_cost: data.finalCost,        // ❌ Nombre de columna DB
}

await updateRepair(selectedRepair.id, updatePayload as unknown as Repair)
```

**Después:**
```typescript
const updatePayload: Partial<Repair> = {
  brand: d.brand,                    // ✅ Nombre TypeScript
  model: d.model,                    // ✅ Nombre TypeScript
  deviceType: d.deviceType,          // ✅ Nombre TypeScript
  issue: d.issue,                    // ✅ Nombre TypeScript
  description: d.description,        // ✅ Nombre TypeScript
  accessType: d.accessType || 'none',
  accessPassword: d.accessPassword || null,
  priority: data.priority,
  urgency,
  estimatedCost: d.estimatedCost,    // ✅ Nombre TypeScript
  laborCost: data.laborCost || 0,    // ✅ Nombre TypeScript
  finalCost: data.finalCost,         // ✅ Nombre TypeScript
  technician: d.technician ? { id: d.technician, name: '' } : undefined
}

await updateRepair(selectedRepair.id, updatePayload)
```

### ✅ Archivo 2: `src/hooks/use-repairs.ts`

**Antes:**
```typescript
const response = await supabase
  .from('repairs')
  .update({
    device_brand: data.brand,
    device_model: data.model,
    problem_description: data.issue,
    diagnosis: data.description,
    estimated_cost: data.estimatedCost,
    access_type: data.accessType || 'none',
    access_password: data.accessPassword || null,
    technician_id: data.technician?.id
    // ❌ Faltaban labor_cost y final_cost
  })
  .eq('id', id)
```

**Después:**
```typescript
const response = await supabase
  .from('repairs')
  .update({
    device_brand: data.brand,
    device_model: data.model,
    problem_description: data.issue,
    diagnosis: data.description,
    estimated_cost: data.estimatedCost,
    labor_cost: data.laborCost,        // ✅ Agregado
    final_cost: data.finalCost,        // ✅ Agregado
    access_type: data.accessType || 'none',
    access_password: data.accessPassword || null,
    technician_id: data.technician?.id
  })
  .eq('id', id)
```

### ✅ Archivo 3: `src/hooks/use-technician-board.ts`

**Antes:**
```typescript
const { error } = await supabase
  .from('repairs')
  .update({
    device_brand: data.devices[0].brand,
    device_model: data.devices[0].model,
    problem_description: data.devices[0].issue,
    diagnosis: data.devices[0].description,
    estimated_cost: data.devices[0].estimatedCost,
    technician_id: data.devices[0].technician
    // ❌ Faltaban labor_cost y final_cost
  })
  .eq('id', id)
```

**Después:**
```typescript
const { error } = await supabase
  .from('repairs')
  .update({
    device_brand: data.devices[0].brand,
    device_model: data.devices[0].model,
    problem_description: data.devices[0].issue,
    diagnosis: data.devices[0].description,
    estimated_cost: data.devices[0].estimatedCost,
    labor_cost: data.laborCost,        // ✅ Agregado
    final_cost: data.finalCost,        // ✅ Agregado
    technician_id: data.devices[0].technician
  })
  .eq('id', id)
```

## Nota sobre RepairsContext

El archivo `src/contexts/RepairsContext.tsx` **ya tenía el mapeo correcto**:

```typescript
if (repairData.laborCost !== undefined) dbUpdateData.labor_cost = repairData.laborCost
if (repairData.finalCost !== undefined) dbUpdateData.final_cost = repairData.finalCost
```

Por eso era importante usar los nombres TypeScript (`laborCost`, `finalCost`) en lugar de los nombres de columna DB.

## Resultado

✅ Ahora el costo final y el costo de mano de obra se guardan correctamente al editar una reparación desde:
- Dashboard de reparaciones (`/dashboard/repairs`)
- Dashboard de técnicos (`/dashboard/technician`)
- Cualquier otro lugar que use estos hooks

## Archivos Modificados

1. ✅ `src/app/dashboard/repairs/page.tsx` - Corregido uso de nombres TypeScript
2. ✅ `src/hooks/use-repairs.ts` - Agregados campos labor_cost y final_cost
3. ✅ `src/hooks/use-technician-board.ts` - Agregados campos labor_cost y final_cost

---

**Fecha**: 2025-01-13
**Estado**: ✅ Completado y Verificado
