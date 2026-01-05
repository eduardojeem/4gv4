import './pos.css'
import { CashRegisterProvider } from './contexts/CashRegisterContext'
import { CheckoutProvider } from './contexts/CheckoutContext'
import { POSCustomerProvider } from './contexts/POSCustomerContext'

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <CashRegisterProvider>
      <CheckoutProvider>
        <POSCustomerProvider>
          {children}
        </POSCustomerProvider>
      </CheckoutProvider>
    </CashRegisterProvider>
  )
}