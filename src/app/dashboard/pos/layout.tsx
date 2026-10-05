import './pos.css'
import { CashRegisterProvider } from './contexts/CashRegisterContext'
import { CheckoutProvider } from './contexts/CheckoutContext'
import { POSCustomerProvider } from './contexts/POSCustomerContext'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'

export default function POSLayout({ children }: { children: React.ReactNode }) {
  // Por fuera de los proveedores: sin el módulo no se abre la caja ni se cargan datos.
  return (
    <OrganizationModuleGate module="pos">
      <CashRegisterProvider>
        <CheckoutProvider>
          <POSCustomerProvider>
            {children}
          </POSCustomerProvider>
        </CheckoutProvider>
      </CashRegisterProvider>
    </OrganizationModuleGate>
  )
}