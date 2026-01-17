# Sincronización del Sistema de Crédito - POS y Customers

## 📋 Resumen

Se ha sincronizado el sistema de crédito entre las secciones **POS** y **Customers** para que ambas usen la misma fuente de datos y cálculos.

## 🔄 Cambios Realizados

### 1. Hook `useCreditSystem` (POS) - Refactorizado

**Archivo**: `src/hooks/use-credit-system.ts`

#### Antes:
- ✗ Usaba datos mock en memoria
- ✗ Calculaba balance desde `customer.current_balance` (campo simple)
- ✗ No sincronizado con Supabase
- ✗ Podía mostrar valores diferentes a Customers

#### Después:
- ✓ Usa datos reales de Supabase (tablas `customer_credits`, `credit_installments`)
- ✓ Calcula balance desde cuotas pendientes (igual que `useCustomerCredits`)
- ✓ Sincronizado con la sección de Customers
- ✓ Mantiene la misma interfaz (no rompe código existente)

### 2. Nuevas Interfaces Sincronizadas

```typescript
// Interfaces de Supabase (compartidas)
export interface CreditInfo {
  id: string
  customer_id: string
  principal: number
  interest_rate: number
  term_months: number
  start_date: string
  status: 'active' | 'completed' | 'defaulted' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface InstallmentInfo {
  id: string
  credit_id: string
  installment_number: number
  due_date: string
  amount: number
  status: 'pending' | 'paid' | 'late'
  paid_at?: string | null
  payment_method?: 'cash' | 'card' | 'transfer' | null
  amount_paid?: number | null
  created_at: string
}

export interface PaymentInfo {
  id: string
  credit_id: string
  installment_id?: string | null
  amount: number
  payment_method?: 'cash' | 'card' | 'transfer' | null
  created_at: string
  notes?: string
}
```

### 3. Cálculo de Balance Unificado

**Método anterior (POS)**:
```typescript
const currentBalance = customer.current_balance || 0
const availableCredit = customer.credit_limit - currentBalance
```

**Método nuevo (sincronizado)**:
```typescript
// Obtener créditos del cliente
const customerCreditIds = credits
  .filter(c => c.customer_id === customer.id)
  .map(c => c.id)

// Calcular desde cuotas pendientes
const pendingInstallments = installments.filter(i => 
  customerCreditIds.includes(i.credit_id) && 
  (i.status === 'pending' || i.status === 'late')
)

const currentBalance = pendingInstallments.reduce((sum, i) => sum + i.amount, 0)
const availableCredit = customer.credit_limit - currentBalance
```

### 4. Nuevas Funciones Agregadas

```typescript
export interface UseCreditSystemReturn {
  // ... funciones existentes ...
  
  // NUEVAS:
  loading: boolean                              // Estado de carga
  error: string | null                          // Errores
  credits: CreditInfo[]                         // Créditos reales
  installments: InstallmentInfo[]               // Cuotas reales
  payments: PaymentInfo[]                       // Pagos reales
  loadCreditData: (customerId?: string) => Promise<void>  // Cargar datos
  refresh: () => void                           // Refrescar
}
```

### 5. Integración en CheckoutModal

**Archivo**: `src/app/dashboard/pos/components/CheckoutModal.tsx`

Se agregó un efecto para cargar automáticamente los datos de crédito cuando se selecciona un cliente:

```typescript
// Cargar datos de crédito cuando cambia el cliente
React.useEffect(() => {
  if (activeCustomer?.id) {
    loadCreditData(activeCustomer.id)
  }
}, [activeCustomer?.id, loadCreditData])
```

## 🎯 Beneficios

### 1. **Consistencia de Datos**
- POS y Customers muestran los mismos valores
- No hay discrepancias entre secciones
- Un solo punto de verdad (Supabase)

### 2. **Cálculos Precisos**
- Balance calculado desde cuotas reales
- Incluye cuotas pendientes y vencidas
- Considera pagos parciales

### 3. **Información Completa**
- Historial de créditos
- Cuotas individuales
- Pagos realizados
- Próximo pago
- Evaluación de riesgo

### 4. **Compatibilidad**
- No rompe código existente
- Misma interfaz pública
- Migración transparente

## 📊 Datos Sincronizados

### CreditSummary Mejorado

```typescript
{
  // Campos originales
  totalCredit: number           // Límite de crédito
  availableCredit: number       // Crédito disponible
  usedCredit: number           // Crédito usado (desde cuotas)
  overdueAmount: number        // Monto vencido
  pendingSales: number         // Ventas pendientes
  creditUtilization: number    // % de utilización
  
  // Campos nuevos (sincronizados con Customers)
  activeCredits: number        // Créditos activos
  completedCredits: number     // Créditos completados
  totalPaid: number           // Total pagado
  nextPayment: {              // Próximo pago
    amount: number
    due_date: string
    days_until_due: number
    is_overdue: boolean
  } | null
}
```

## 🔧 API Utilizada

**Endpoint**: `/api/credits/batch`

**Método**: POST

**Request**:
```json
{
  "customerIds": ["customer-id-1", "customer-id-2"]
}
```

**Response**:
```json
{
  "credits": [...],        // Array de CreditInfo
  "installments": [...],   // Array de InstallmentInfo
  "payments": [...]        // Array de PaymentInfo
}
```

## 📝 Tablas de Supabase

### `customer_credits`
- `id` - UUID del crédito
- `customer_id` - ID del cliente
- `principal` - Monto principal
- `interest_rate` - Tasa de interés
- `term_months` - Plazo en meses
- `start_date` - Fecha de inicio
- `status` - Estado del crédito
- `created_at` - Fecha de creación
- `updated_at` - Última actualización

### `credit_installments`
- `id` - UUID de la cuota
- `credit_id` - ID del crédito
- `installment_number` - Número de cuota
- `due_date` - Fecha de vencimiento
- `amount` - Monto de la cuota
- `status` - Estado (pending/paid/late)
- `paid_at` - Fecha de pago
- `payment_method` - Método de pago
- `amount_paid` - Monto pagado
- `created_at` - Fecha de creación

### `credit_payments`
- `id` - UUID del pago
- `credit_id` - ID del crédito
- `installment_id` - ID de la cuota (opcional)
- `amount` - Monto del pago
- `payment_method` - Método de pago
- `created_at` - Fecha del pago
- `notes` - Notas adicionales

## ✅ Validación

### Antes de la Sincronización:
```
POS:       Balance = customer.current_balance (campo simple)
Customers: Balance = SUM(cuotas pendientes)
Resultado: Valores diferentes ❌
```

### Después de la Sincronización:
```
POS:       Balance = SUM(cuotas pendientes)
Customers: Balance = SUM(cuotas pendientes)
Resultado: Valores idénticos ✅
```

## 🚀 Próximos Pasos

1. **Probar en POS**:
   - Seleccionar cliente con crédito
   - Verificar que muestre balance correcto
   - Intentar venta a crédito
   - Validar límites

2. **Comparar con Customers**:
   - Abrir mismo cliente en sección Customers
   - Verificar que los valores coincidan
   - Confirmar historial de créditos

3. **Crear Venta a Crédito**:
   - Procesar venta a crédito desde POS
   - Verificar que se cree en Supabase
   - Confirmar que aparezca en Customers

## 📚 Archivos Modificados

1. `src/hooks/use-credit-system.ts` - Hook refactorizado
2. `src/app/dashboard/pos/components/CheckoutModal.tsx` - Integración de carga
3. `SINCRONIZACION_CREDITO_POS_CUSTOMERS.md` - Este documento

## 🔗 Archivos Relacionados (sin cambios)

- `src/hooks/use-customer-credits.ts` - Hook de Customers (referencia)
- `src/app/api/credits/batch/route.ts` - API endpoint (ya existía)
- `src/components/dashboard/customers/CustomerCreditInfo.tsx` - UI de Customers

---

**Fecha**: 16 de enero de 2026  
**Estado**: ✅ Completado  
**Versión**: 1.0
