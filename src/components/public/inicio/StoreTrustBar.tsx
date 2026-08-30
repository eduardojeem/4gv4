import { CreditCard, ShieldCheck, Truck, MessageCircle } from 'lucide-react'

export function StoreTrustBar() {
  const benefits = [
    {
      icon: Truck,
      title: 'Envíos Rápidos',
      description: 'A domicilio o retiro en tienda',
    },
    {
      icon: CreditCard,
      title: 'Medios de Pago',
      description: 'Tarjetas, cuotas y transferencias',
    },
    {
      icon: ShieldCheck,
      title: 'Compra Segura',
      description: 'Garantía oficial en tus compras',
    },
    {
      icon: MessageCircle,
      title: 'Atención Directa',
      description: 'Asesoramiento personalizado',
    },
  ]

  return (
    <div className="border-b border-border/80 bg-card py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {benefits.map((b) => {
            const Icon = b.icon
            return (
              <div
                key={b.title}
                className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-background/60 p-3.5 transition-all hover:border-primary/40 hover:shadow-xs"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                    {b.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {b.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
