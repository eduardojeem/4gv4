
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditPayment } from "./credits-client"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface PaymentHistoryProps {
  payments: CreditPayment[]
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-muted-foreground">No hay historial de pagos registrado.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Pagos</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Referencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment, idx) => (
              <TableRow key={payment.id} className={idx % 2 === 0 ? 'bg-muted/30' : ''}>
                <TableCell>
                  {format(new Date(payment.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(payment.created_at), "HH:mm", { locale: es })}
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  Gs. {payment.amount.toLocaleString("es-PY")}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {payment.payment_method}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {payment.notes || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
