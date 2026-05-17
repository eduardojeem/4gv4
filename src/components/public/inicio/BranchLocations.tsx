import { MapPin, Phone, Clock, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BrandTheme } from '@/lib/constants/brand-theme'

export interface BranchLocationData {
  id: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  managerName: string | null
  isDefault: boolean
}

interface BranchLocationsProps {
  branches: BranchLocationData[]
  brand: BrandTheme
}

export function BranchLocations({ branches, brand }: BranchLocationsProps) {
  // Don't render if there's only one branch or none
  if (branches.length <= 1) return null

  return (
    <section className="border-t bg-muted/30 py-16 md:py-20">
      <div className="container">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Nuestras Sucursales
          </h2>
          <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
            Visitanos en cualquiera de nuestras ubicaciones. Todas con el mismo servicio y garantía.
          </p>
        </div>

        <div className={`grid gap-5 ${branches.length === 2 ? 'sm:grid-cols-2 max-w-3xl mx-auto' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {branches.map((branch) => {
            const phoneClean = branch.phone?.replace(/\D/g, '') || ''
            const whatsappUrl = phoneClean
              ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(`Hola, consulto desde la web por la sucursal ${branch.name}`)}`
              : null

            return (
              <div
                key={branch.id}
                className="relative flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                {branch.isDefault && (
                  <span className="absolute -top-2.5 right-4 inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Principal
                  </span>
                )}

                <div className="flex items-start gap-3 mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${brand.stepBg} shrink-0`}>
                    <MapPin className={`h-5 w-5 ${brand.stepText}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{branch.name}</h3>
                    {branch.city && (
                      <p className="text-sm text-muted-foreground">{branch.city}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 flex-1">
                  {branch.address && (
                    <div className="flex items-start gap-2.5 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a
                        href={`tel:${phoneClean}`}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {branch.phone}
                      </a>
                    </div>
                  )}
                </div>

                {whatsappUrl && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl gap-2"
                    >
                      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4" />
                        Escribir a esta sucursal
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
