import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rastrear Reparación | 4G Celulares',
  description: 'Rastrea el estado de tu reparación en tiempo real. Ingresa tu número de ticket y contacto para ver el progreso de tu dispositivo.',
  keywords: 'rastrear reparación, estado reparación, seguimiento reparación, ticket reparación',
  robots: {
    index: true,
    follow: false // No indexar detalles individuales de reparaciones
  },
  openGraph: {
    title: 'Rastrear Reparación | 4G Celulares',
    description: 'Rastrea el estado de tu reparación en tiempo real',
    type: 'website'
  }
}

export default function MisReparacionesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
    </>
  )
}
