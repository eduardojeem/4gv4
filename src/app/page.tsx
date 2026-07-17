import { redirect } from 'next/navigation'

export default function RootPage() {
  // Redirigir siempre al marketplace
  redirect('/marketplace')
}
