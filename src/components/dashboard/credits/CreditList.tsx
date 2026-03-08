import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Users, DollarSign, Calendar, Percent, TrendingUp, Eye } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { formatCustomerId, formatCreditId } from '@/lib/utils'
import { CreditRow } from '@/hooks/use-credits'

interface CreditListProps {
    credits: CreditRow[]
    remainingByCredit: Record<string, number>
    paidByCredit: Record<string, number>
    onRegisterPayment: (creditId: string) => void
    onViewDetail?: (creditId: string) => void
    viewMode?: 'cards' | 'list' | 'table'
}

export function CreditList({
    credits,
    remainingByCredit,
    paidByCredit,
    onRegisterPayment,
    onViewDetail,
    viewMode = 'cards',
}: CreditListProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700'
            case 'completed':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700'
            case 'defaulted':
                return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700'
            case 'cancelled':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-300 dark:border-gray-700'
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
        }
    }

    const renderEmpty = () => (
        <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay créditos activos</p>
        </div>
    )

    const renderCards = () => (
        <div className="space-y-3">
            {credits.map((c) => {
                const paid = Number(paidByCredit[c.id] || 0)
                const remaining = Number(remainingByCredit[c.id] || 0)
                const total = paid + remaining
                const progressPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0

                return (
                    <div
                        key={c.id}
                        className="group border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 overflow-hidden"
                    >
                        <div className="p-5">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h4 className="font-semibold text-base mb-1">
                                                {c.customer_name || `Cliente ${c.customer_code || formatCustomerId(c.customer_id)}`}
                                            </h4>
                                            <p className="text-xs text-muted-foreground">{formatCreditId(c.id)}</p>
                                        </div>
                                        <Badge className={`${getStatusColor(c.status)} font-medium`}>
                                            {c.status === 'active' ? 'Activo' :
                                                c.status === 'completed' ? 'Completado' :
                                                    c.status === 'defaulted' ? 'Moroso' : 'Cancelado'}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                        <div className="flex items-center gap-2">
                                            <DollarSign className="h-4 w-4 text-green-600" />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Principal</p>
                                                <p className="text-sm font-semibold">{formatCurrency(c.principal)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-blue-600" />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Plazo</p>
                                                <p className="text-sm font-semibold">{c.term_months} meses</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Percent className="h-4 w-4 text-orange-600" />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Interés</p>
                                                <p className="text-sm font-semibold">{c.interest_rate}%</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-purple-600" />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Progreso</p>
                                                <p className="text-sm font-semibold">{progressPct}%</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                                            <span>Pagado: {formatCurrency(paid)}</span>
                                            <span>Pendiente: {formatCurrency(remaining)}</span>
                                        </div>
                                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-out"
                                                style={{ width: `${progressPct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                                        onClick={() => onRegisterPayment(c.id)}
                                    >
                                        Registrar pago
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => onViewDetail?.(c.id)}
                                    >
                                        <Eye className="h-4 w-4 mr-1" />
                                        Ver detalle
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )

    const renderList = () => (
        <div className="space-y-2">
            {credits.map((c) => {
                const paid = Number(paidByCredit[c.id] || 0)
                const remaining = Number(remainingByCredit[c.id] || 0)
                return (
                    <div key={c.id} className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{c.customer_name || `Cliente ${c.customer_code || formatCustomerId(c.customer_id)}`}</div>
                            <div className="text-xs text-muted-foreground">{formatCreditId(c.id)}</div>
                        </div>
                        <div className="text-sm min-w-[140px]">Pendiente: <span className="font-semibold">{formatCurrency(remaining)}</span></div>
                        <div className="text-sm min-w-[140px]">Pagado: <span className="font-semibold">{formatCurrency(paid)}</span></div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => onRegisterPayment(c.id)}>Pago</Button>
                            <Button size="sm" variant="outline" onClick={() => onViewDetail?.(c.id)}>Detalle</Button>
                        </div>
                    </div>
                )
            })}
        </div>
    )

    const renderTable = () => (
        <div className="rounded-lg border overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Crédito</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Pagado</TableHead>
                        <TableHead className="text-right">Pendiente</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {credits.map((c) => {
                        const paid = Number(paidByCredit[c.id] || 0)
                        const remaining = Number(remainingByCredit[c.id] || 0)
                        return (
                            <TableRow key={c.id}>
                                <TableCell>{c.customer_name || `Cliente ${c.customer_code || formatCustomerId(c.customer_id)}`}</TableCell>
                                <TableCell className="font-mono text-xs">{formatCreditId(c.id)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(c.principal)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(paid)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(remaining)}</TableCell>
                                <TableCell>
                                    <Badge className={getStatusColor(c.status)}>
                                        {c.status === 'active' ? 'Activo' :
                                            c.status === 'completed' ? 'Completado' :
                                                c.status === 'defaulted' ? 'Moroso' : 'Cancelado'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button size="sm" onClick={() => onRegisterPayment(c.id)}>Pago</Button>
                                        <Button size="sm" variant="outline" onClick={() => onViewDetail?.(c.id)}>Detalle</Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )

    return (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Créditos activos
                    <Badge variant="secondary" className="ml-2">{credits.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {credits.length === 0
                    ? renderEmpty()
                    : viewMode === 'table'
                        ? renderTable()
                        : viewMode === 'list'
                            ? renderList()
                            : renderCards()}
            </CardContent>
        </Card>
    )
}

