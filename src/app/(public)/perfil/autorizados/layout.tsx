import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Personas Autorizadas',
  description: 'Gestioná quiénes pueden retirar tus equipos en tu nombre.',
  robots: { index: false, follow: false },
}

export default function AutorizadosLayout({ children }: { children: React.ReactNode }) {
  return children
}
