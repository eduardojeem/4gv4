import './pos.css'
import { CashRegisterProvider } from './contexts/CashRegisterContext'

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <CashRegisterProvider>
      {children}
    </CashRegisterProvider>
  )
}