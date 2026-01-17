# Corrección: Límite de Crédito en POS

## Problema Detectado
El usuario reportó que clientes con límite de crédito configurado aparecían como "Crédito no habilitado" en el POS (CheckoutModal).

## Diagnóstico
El componente `CustomerSyncSection` es el encargado de sincronizar/adaptar los datos del contexto global de clientes (`useCustomers`) hacia el contexto local del POS (`usePOSCustomer`).

Al revisar `src/app/dashboard/pos/components/CustomerSyncSection.tsx`, se detectó que el mapeo de propiedades **no incluía el campo `credit_limit`**.

```typescript
// Código ANTERIOR (con error)
const mapped = (customers || []).map((c: any) => ({
  id: c.id,
  name: c.name || '',
  // ...
  current_balance: c.current_balance || 0,
  // FALTA credit_limit
  last_visit: c.last_visit || null,
  // ...
}))
```

Esto causaba que el objeto `activeCustomer` en el POS tuviera `credit_limit: undefined`.

El hook `useCreditSystem` valida así:
```typescript
if (!customer.credit_limit || customer.credit_limit <= 0) {
  return false // Crédito no habilitado
}
```
Como `credit_limit` era undefined, la validación fallaba siempre.

## Solución Aplicada
Se modificó `src/app/dashboard/pos/components/CustomerSyncSection.tsx` para incluir explícitamente el campo `credit_limit` en el mapeo.

```typescript
// Código NUEVO (corregido)
const mapped = (customers || []).map((c: any) => ({
  // ...
  current_balance: c.current_balance || 0,
  credit_limit: c.credit_limit || 0, // <-- AGREGADO
  last_visit: c.last_visit || null,
  // ...
}))
```

## Verificación
Ahora el POS recibe correctamente el límite de crédito del cliente.
- Si `credit_limit > 0` -> El botón de crédito se habilitará (si hay saldo disponible).
- Si `credit_limit === 0` -> Mostrará correctamente "Crédito no habilitado".
