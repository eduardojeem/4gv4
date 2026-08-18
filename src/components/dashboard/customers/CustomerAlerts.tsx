'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  Clock,
  UserPlus,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import type { Customer } from '@/hooks/use-customer-state'
import { customerService } from '@/services/customer-service'

interface CustomerAlertsProps {
  customers: Customer[]
  onViewCustomer?: (customer: Customer) => void
}

type Severity = 'critical' | 'warning' | 'info'

interface AlertGroup {
  id: string
  severity: Severity
  icon: React.ReactNode
  title: string
  description: string
  customers: Customer[]
  buildMessage: (c: Customer) => string
}

const DAY = 24 * 60 * 60 * 1000

const severityStyles: Record<Severity, { card: string; icon: string; badge: string }> = {
  critical: {
    card: 'border-red-200 dark:border-red-900/50',
    icon: 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  },
  warning: {
    card: 'border-amber-200 dark:border-amber-900/50',
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  },
  info: {
    card: 'border-blue-200 dark:border-blue-900/50',
    icon: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  },
}

function waLink(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '')
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
}

export function CustomerAlerts({ customers, onViewCustomer }: CustomerAlertsProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  /**
   * El saldo sale de las cuotas pendientes, no de `customers.current_balance`:
   * esa columna no la actualiza nadie y quedaba en 0, asi que esta alerta
   * —la mas importante para un taller— no aparecia nunca.
   */
  const customerIds = useMemo(
    () => customers.map((customer) => customer.id).filter(Boolean),
    [customers],
  )

  const { data: outstandingByCustomer } = useSWR(
    customerIds.length > 0 ? ['customers-outstanding', customerIds.join(',')] : null,
    () => customerService.getCustomersCreditOutstanding(customerIds),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )

  // Una sola marca de tiempo por montaje: leer el reloj dentro del useMemo lo
  // volvia impuro y movia el corte de "inactivo" en cada recalculo.
  const [now] = useState(() => Date.now())

  const groups = useMemo<AlertGroup[]>(() => {
    const result: AlertGroup[] = []
    const debtOf = (customer: Customer) => outstandingByCustomer?.get(customer.id) ?? 0

    // 1. Saldo pendiente (deuda) — lo más importante para un taller
    const withDebt = customers
      .filter(c => debtOf(c) > 0)
      .sort((a, b) => debtOf(b) - debtOf(a))
    if (withDebt.length > 0) {
      const total = withDebt.reduce((s, c) => s + debtOf(c), 0)
      result.push({
        id: 'debt',
        severity: 'critical',
        icon: <AlertTriangle className="h-5 w-5" />,
        title: 'Clientes con saldo pendiente',
        description: `${withDebt.length} cliente(s) deben ${formatCurrency(total)} en total`,
        customers: withDebt,
        buildMessage: c =>
          `Hola ${c.name}, te recordamos que tenés un saldo pendiente de ${formatCurrency(debtOf(c))}. ¡Cualquier consulta estamos a tu disposición!`,
      })
    }

    // 2. Buenos clientes inactivos (>60 días sin venir) — recuperar
    const inactive = customers
      .filter(c => {
        const valuable = c.segment === 'vip' || (c.lifetime_value || 0) > 500000
        const lastSeen = new Date(c.last_visit || c.last_activity).getTime()
        return valuable && now - lastSeen > 60 * DAY
      })
      .sort((a, b) => (b.lifetime_value || 0) - (a.lifetime_value || 0))
    if (inactive.length > 0) {
      result.push({
        id: 'inactive',
        severity: 'warning',
        icon: <Clock className="h-5 w-5" />,
        title: 'Buenos clientes que no vuelven',
        description: `${inactive.length} cliente(s) de valor sin actividad hace más de 60 días`,
        customers: inactive,
        buildMessage: c =>
          `Hola ${c.name}, ¡hace tiempo que no te vemos! Pasá cuando quieras, tenemos novedades para vos.`,
      })
    }

    // 3. Clientes nuevos (últimos 7 días) — bienvenida / seguimiento
    const recent = customers
      .filter(c => now - new Date(c.registration_date).getTime() < 7 * DAY)
      .sort((a, b) => new Date(b.registration_date).getTime() - new Date(a.registration_date).getTime())
    if (recent.length > 0) {
      result.push({
        id: 'new',
        severity: 'info',
        icon: <UserPlus className="h-5 w-5" />,
        title: 'Clientes nuevos esta semana',
        description: `${recent.length} cliente(s) se registraron en los últimos 7 días`,
        customers: recent,
        buildMessage: c =>
          `Hola ${c.name}, ¡gracias por elegirnos! Quedamos a tu disposición para lo que necesites.`,
      })
    }

    return result
    // Sin `outstandingByCustomer` el memo no se recalcula cuando llegan los
    // saldos, y la alerta seguiria sin aparecer.
  }, [customers, now, outstandingByCustomer])

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold">¡Todo al día!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          No hay alertas de clientes que requieran tu atención ahora.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map(group => {
        const styles = severityStyles[group.severity]
        const isOpen = expanded[group.id]
        const preview = group.customers.slice(0, isOpen ? group.customers.length : 0)

        return (
          <Card key={group.id} className={cn('overflow-hidden shadow-sm', styles.card)}>
            <button
              type="button"
              onClick={() => setExpanded(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
            >
              <div className={cn('h-10 w-10 shrink-0 rounded-xl flex items-center justify-center', styles.icon)}>
                {group.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{group.title}</h3>
                  <Badge className={cn('shrink-0', styles.badge)}>{group.customers.length}</Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">{group.description}</p>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
            </button>

            {isOpen && (
              <CardContent className="pt-0 pb-3 space-y-2">
                {preview.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3"
                  >
                    <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                      {c.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {group.id === 'debt'
                          ? `Debe ${formatCurrency(c.current_balance || 0)}`
                          : c.phone || 'Sin teléfono'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {c.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          asChild
                        >
                          <a
                            href={waLink(c.phone, group.buildMessage(c))}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageSquare className="h-4 w-4 text-emerald-600" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </a>
                        </Button>
                      )}
                      {onViewCustomer && (
                        <Button variant="ghost" size="sm" onClick={() => onViewCustomer(c)}>
                          Ver
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
