import Link from 'next/link'
import { Mail, Phone, MapPin, Clock } from 'lucide-react'

export function PublicFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Empresa */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">Empresa</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-foreground">
                  Inicio
                </Link>
              </li>
              <li>
                <Link href="/productos" className="text-muted-foreground hover:text-foreground">
                  Productos
                </Link>
              </li>
              <li>
                <Link href="/mis-reparaciones" className="text-muted-foreground hover:text-foreground">
                  Mis Reparaciones
                </Link>
              </li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">Contacto</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <span className="text-muted-foreground">+595 123 456 789</span>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <span className="text-muted-foreground">info@4gcelulares.com</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Av. Principal 123, Asunción
                </span>
              </li>
            </ul>
          </div>

          {/* Horarios */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">Horarios</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5" />
                <div>
                  <div>Lun - Vie: 8:00 - 18:00</div>
                  <div>Sábados: 9:00 - 13:00</div>
                  <div>Domingos: Cerrado</div>
                </div>
              </li>
            </ul>
          </div>

          {/* Redes */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">Síguenos</h3>
            <div className="flex gap-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                Facebook
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                Instagram
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} 4G Celulares. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
