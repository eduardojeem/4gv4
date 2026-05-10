
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Calendar,
  CreditCard as CreditCardIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CreditItem } from './credits-client'

interface CreditCardProps {
  credit: CreditItem
}

export function CreditCard({ credit }: CreditCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const paidCount = credit.installments.filter(i => i.status === 'paid').length
  const totalAmount = credit.installments.reduce((sum, i) => sum + i.amount, 0)
  const paidAmount = credit.installments
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.amount, 0)
  
  const nextPending = credit.installments
    .filter(i => i.status === 'pending' || i.status === 'late')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]
  
  const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0
  const progressColor = progress >= 70 ? 'var(--success)' : progress >= 30 ? 'var(--warning)' : 'var(--destructive)'
  
  const statusConfig = {
    active: { label: 'Activo', className: 'bg-primary/10 text-primary border-primary/20' },
    completed: { label: 'Completado', className: 'bg-success/10 text-success border-success/20' },
    defaulted: { label: 'En Mora', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    cancelled: { label: 'Cancelado', className: 'bg-muted text-muted-foreground border-border' }
  }

  const getInstallmentStatusIcon = (status: string) => {
    switch(status) {
      case 'paid': return <CheckCircle2 className="h-3.5 w-3.5" />
      case 'late': return <AlertTriangle className="h-3.5 w-3.5" />
      default: return <Clock className="h-3.5 w-3.5" />
    }
  }

  const getInstallmentStatusColor = (status: string) => {
    switch(status) {
      case 'paid': return 'text-success bg-success/5 border-success/20'
      case 'late': return 'text-destructive bg-destructive/5 border-destructive/20'
      default: return 'text-warning bg-warning/5 border-warning/20'
    }
  }

  return (
    <Card className="overflow-hidden border shadow-sm transition-all hover:shadow-md">
      <CardHeader className="bg-muted/10 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5 text-muted-foreground" />
                Línea de Crédito
              </CardTitle>
              <Badge variant="outline" className={statusConfig[credit.status].className}>
                {statusConfig[credit.status].label}
              </Badge>
            </div>
            <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Iniciado el {new Date(credit.start_date).toLocaleDateString('es-PY')}
              </span>
              {credit.created_at && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  · Alta {new Date(credit.created_at).toLocaleDateString('es-PY')}
                </span>
              )}
            </CardDescription>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <div className="text-sm text-muted-foreground">Monto Total</div>
            <div className="text-xl font-bold">Gs. {totalAmount.toLocaleString('es-PY')}</div>
            {nextPending && (
              <Badge variant="outline" className="mt-1 gap-1 bg-warning/10 border-warning/30 text-warning">
                <Clock className="h-3 w-3" />
                Próx. {new Date(nextPending.due_date).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })}
                · Gs. {nextPending.amount.toLocaleString('es-PY')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso de pago</span>
              <span className="font-medium">{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className="h-2" indicatorColor={progressColor} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Pagado: Gs. {paidAmount.toLocaleString('es-PY')}</span>
              <span>Pendiente: Gs. {(totalAmount - paidAmount).toLocaleString('es-PY')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
              <div className="text-xs text-muted-foreground">Cuotas Pagadas</div>
              <div className="text-lg font-semibold mt-1">
                {paidCount} <span className="text-sm font-normal text-muted-foreground">/ {credit.term_months}</span>
              </div>
            </div>
            <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
              <div className="text-xs text-muted-foreground">Monto Original</div>
              <div className="text-lg font-semibold mt-1">
                Gs. {credit.principal.toLocaleString('es-PY')}
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="px-6 pb-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between hover:bg-muted/50 group">
              <span className="text-sm font-medium group-hover:text-primary transition-colors">
                {isOpen ? 'Ocultar detalles de cuotas' : 'Ver detalles de cuotas'}
              </span>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="border-t border-border bg-muted/5">
            <div className="divide-y divide-border">
              {credit.installments.sort((a, b) => a.installment_number - b.installment_number).map((installment) => (
                <div 
                  key={installment.id} 
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 transition-colors hover:bg-muted/20",
                    installment.status === 'late' && "bg-destructive/5 hover:bg-destructive/10"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border",
                      installment.status === 'paid' ? "bg-success/10 text-success border-success/20" : 
                      installment.status === 'late' ? "bg-destructive/10 text-destructive border-destructive/20" :
                      "bg-muted text-muted-foreground border-border"
                    )}>
                      {installment.installment_number}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        Gs. {installment.amount.toLocaleString('es-PY')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vence {new Date(installment.due_date).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pl-12 sm:pl-0">
                    {installment.amount_paid && installment.amount_paid > 0 && installment.status !== 'pending' && (
                      <span className="text-xs text-muted-foreground hidden sm:inline-block">
                        Pagado: Gs. {installment.amount_paid.toLocaleString('es-PY')}
                      </span>
                    )}
                    <Badge variant="outline" className={cn("gap-1.5", getInstallmentStatusColor(installment.status))}>
                      {getInstallmentStatusIcon(installment.status)}
                      <span className="capitalize">
                        {installment.status === 'paid' ? 'Pagado' : 
                         installment.status === 'late' ? 'Atrasado' : 'Pendiente'}
                      </span>
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
