'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, Scale, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageHeader, Notice } from '@/components/superadmin/ui/page-header'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_RECURRENCES,
  RECURRENCE_LABEL,
  expenseToPyg,
  monthlyRecurringPyg,
  type ExpenseCategory,
  type ExpenseCurrency,
  type ExpenseRecurrence,
  type FinanceSummary,
  type PlatformExpense,
} from '@/lib/superadmin/platform-finance'
import { createExpenseAction, deleteExpenseAction, updateExpenseAction } from '@/app/superadmin/finanzas/actions'

const gs = (value: number) => formatCurrency(Math.round(value), { currency: 'PYG' })

type FormState = {
  id: string | null
  provider: string
  category: ExpenseCategory
  description: string
  amount: string
  currency: ExpenseCurrency
  fxRatePyg: string
  recurrence: ExpenseRecurrence
  startsOn: string
  endsOn: string
  isActive: boolean
}

function expenseStatus(expense: PlatformExpense, today: string) {
  if (!expense.isActive) return { label: 'Pausado', tone: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' }
  if (expense.startsOn > today) return { label: 'Programado', tone: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300' }
  if (expense.endsOn && expense.endsOn < today) return { label: 'Finalizado', tone: 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400' }
  return { label: 'Vigente', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' }
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p
          className={cn(
            'mt-1.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50',
            tone === 'good' && 'text-emerald-700 dark:text-emerald-300',
            tone === 'bad' && 'text-red-700 dark:text-red-300',
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ key: string; label: string; monthly: number; sharePercent: number }> }) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Costo mensual recurrente</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Sin gastos recurrentes vigentes.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.key} className="relative overflow-hidden rounded-md">
                <div className="absolute inset-y-0 left-0 rounded-md bg-primary/10" style={{ width: `${Math.max(row.sharePercent, 2)}%` }} aria-hidden />
                <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">
                  <span className="min-w-0 truncate">{row.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {gs(row.monthly)} <span className="ml-1 text-xs font-normal text-slate-500">{row.sharePercent}%</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function PlatformFinanceCenter({
  expenses,
  summary,
  activeOrgs,
  today,
  unavailableReason,
}: {
  expenses: PlatformExpense[]
  summary: FinanceSummary
  activeOrgs: number
  today: string
  unavailableReason: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState | null>(null)
  const [toDelete, setToDelete] = useState<PlatformExpense | null>(null)

  // El último tipo de cambio cargado sirve de sugerencia para el próximo gasto en dólares.
  const lastUsdRate = useMemo(() => expenses.find((e) => e.currency === 'USD')?.fxRatePyg, [expenses])

  const emptyForm = (): FormState => ({
    id: null,
    provider: '',
    category: 'infraestructura',
    description: '',
    amount: '',
    currency: 'USD',
    fxRatePyg: lastUsdRate ? String(lastUsdRate) : '',
    recurrence: 'monthly',
    startsOn: today,
    endsOn: '',
    isActive: true,
  })

  const editForm = (expense: PlatformExpense): FormState => ({
    id: expense.id,
    provider: expense.provider,
    category: expense.category,
    description: expense.description ?? '',
    amount: String(expense.amount),
    currency: expense.currency,
    fxRatePyg: String(expense.fxRatePyg),
    recurrence: expense.recurrence,
    startsOn: expense.startsOn,
    endsOn: expense.endsOn ?? '',
    isActive: expense.isActive,
  })

  const save = () => {
    if (!form) return
    const payload = {
      provider: form.provider,
      category: form.category,
      description: form.description.trim() || null,
      amount: Number(form.amount),
      currency: form.currency,
      fxRatePyg: form.currency === 'PYG' ? 1 : Number(form.fxRatePyg),
      recurrence: form.recurrence,
      startsOn: form.startsOn,
      endsOn: form.endsOn || null,
      isActive: form.isActive,
    }
    if (form.amount.trim() === '' || !Number.isFinite(payload.amount)) {
      toast.error('Indicá el monto')
      return
    }
    if (form.currency === 'USD' && !(payload.fxRatePyg > 0)) {
      toast.error('Indicá el tipo de cambio (guaraníes por dólar)')
      return
    }
    startTransition(async () => {
      const result = form.id ? await updateExpenseAction(form.id, payload) : await createExpenseAction(payload)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(form.id ? 'Gasto actualizado' : 'Gasto registrado')
      setForm(null)
      router.refresh()
    })
  }

  const confirmDelete = () => {
    if (!toDelete) return
    const id = toDelete.id
    startTransition(async () => {
      const result = await deleteExpenseAction(id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Gasto eliminado')
      setToDelete(null)
      router.refresh()
    })
  }

  const previewPyg = form && form.amount ? Number(form.amount) * (form.currency === 'PYG' ? 1 : Number(form.fxRatePyg) || 0) : 0
  const profitable = summary.netMonthly >= 0

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Gastos y rentabilidad"
        description="Lo que cuesta operar la plataforma frente a lo que ingresa por suscripciones. Montos en guaraníes; los gastos en dólares usan el tipo de cambio guardado en cada uno."
        actions={
          <Button onClick={() => setForm(emptyForm())} disabled={Boolean(unavailableReason)}>
            <Plus className="h-4 w-4" /> Registrar gasto
          </Button>
        }
      />

      {unavailableReason && <Notice tone="warning">{unavailableReason}</Notice>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="MRR" value={gs(summary.mrr)} hint={`${summary.payingOrgs} tiendas pagas de ${activeOrgs} activas`} />
        <Kpi label="Costo mensual" value={gs(summary.recurringMonthlyCost)} hint="Recurrente; anuales divididos en 12" />
        <Kpi
          label="Resultado mensual"
          value={gs(summary.netMonthly)}
          hint="MRR menos costo recurrente"
          tone={profitable ? 'good' : 'bad'}
        />
        <Kpi
          label="Margen"
          value={summary.marginPercent === null ? '—' : `${summary.marginPercent.toLocaleString('es-PY')}%`}
          hint={summary.marginPercent === null ? 'Sin ingresos todavía' : 'Sobre el MRR'}
          tone={summary.marginPercent === null ? undefined : profitable ? 'good' : 'bad'}
        />
        <Kpi
          label="Costo por tienda paga"
          value={summary.costPerPayingOrg === null ? '—' : gs(summary.costPerPayingOrg)}
          hint={summary.revenuePerPayingOrg === null ? 'Sin tiendas pagas' : `Ingreso promedio ${gs(summary.revenuePerPayingOrg)}`}
        />
        <Kpi
          label="Punto de equilibrio"
          value={summary.breakEvenOrgs === null ? '—' : `${summary.breakEvenOrgs} tiendas`}
          hint={
            summary.breakEvenOrgs === null
              ? 'Hace falta al menos una tienda paga'
              : summary.payingOrgs >= summary.breakEvenOrgs
                ? `Cubierto: tenés ${summary.payingOrgs}`
                : `Faltan ${summary.breakEvenOrgs - summary.payingOrgs} tiendas pagas`
          }
        />
      </div>

      {summary.oneTimeThisMonth > 0 && (
        <Card className="rounded-xl">
          <CardContent className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              {summary.netThisMonth >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
              Este mes hubo {gs(summary.oneTimeThisMonth)} en gastos únicos.
            </span>
            <span className="font-semibold tabular-nums">Resultado del mes: {gs(summary.netThisMonth)}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown
          title="Por categoría"
          rows={summary.byCategory.map((row) => ({ key: row.category, label: EXPENSE_CATEGORY_LABEL[row.category], monthly: row.monthly, sharePercent: row.sharePercent }))}
        />
        <Breakdown
          title="Por proveedor"
          rows={summary.byProvider.map((row) => ({ key: row.provider, label: row.provider, monthly: row.monthly, sharePercent: row.sharePercent }))}
        />
      </div>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4" /> Gastos registrados
          </CardTitle>
          <CardDescription>{expenses.length} en total. Pausá un gasto en vez de borrarlo si querés conservar el historial.</CardDescription>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
              Todavía no hay gastos. Empezá por los fijos: hosting (Vercel), base de datos (Supabase), dominio y email.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Proveedor</th>
                    <th className="py-2 pr-3 font-semibold">Frecuencia</th>
                    <th className="py-2 pr-3 text-right font-semibold">Monto</th>
                    <th className="py-2 pr-3 text-right font-semibold">Por mes</th>
                    <th className="py-2 pr-3 font-semibold">Estado</th>
                    <th className="py-2 text-right font-semibold"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => {
                    const status = expenseStatus(expense, today)
                    const monthly = monthlyRecurringPyg(expense, today)
                    return (
                      <tr key={expense.id} className="border-b last:border-0 dark:border-slate-800">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{expense.provider}</div>
                          <div className="text-xs text-slate-500">
                            {EXPENSE_CATEGORY_LABEL[expense.category]}
                            {expense.description ? ` · ${expense.description}` : ''}
                          </div>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">{RECURRENCE_LABEL[expense.recurrence]}</td>
                        <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                          {formatCurrency(expense.amount, { currency: expense.currency })}
                          {expense.currency !== 'PYG' && (
                            <div className="text-xs text-slate-500">{gs(expenseToPyg(expense))}</div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{monthly > 0 ? gs(monthly) : '—'}</td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline" className={cn('font-medium', status.tone)}>{status.label}</Badge>
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" aria-label={`Editar ${expense.provider}`} onClick={() => setForm(editForm(expense))}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={`Eliminar ${expense.provider}`} onClick={() => setToDelete(expense)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={form !== null} onOpenChange={(open) => !open && !pending && setForm(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {form && (
            <>
              <SheetHeader>
                <SheetTitle>{form.id ? 'Editar gasto' : 'Registrar gasto'}</SheetTitle>
                <SheetDescription>Un gasto anual se reparte en 12 meses; uno único pesa solo en el mes en que ocurrió.</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="expense-provider">Proveedor</Label>
                  <Input id="expense-provider" value={form.provider} maxLength={80} placeholder="Vercel, Supabase, dominio..." onChange={(e) => setForm({ ...form, provider: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Categoría</Label>
                    <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value as ExpenseCategory })}>
                      <SelectTrigger aria-label="Categoría"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>{EXPENSE_CATEGORY_LABEL[category]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Frecuencia</Label>
                    <Select value={form.recurrence} onValueChange={(value) => setForm({ ...form, recurrence: value as ExpenseRecurrence })}>
                      <SelectTrigger aria-label="Frecuencia"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_RECURRENCES.map((recurrence) => (
                          <SelectItem key={recurrence} value={recurrence}>{RECURRENCE_LABEL[recurrence]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="expense-amount">Monto</Label>
                    <Input id="expense-amount" type="number" inputMode="decimal" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Moneda</Label>
                    <Select value={form.currency} onValueChange={(value) => setForm({ ...form, currency: value as ExpenseCurrency })}>
                      <SelectTrigger aria-label="Moneda"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="PYG">Gs.</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.currency === 'USD' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="expense-fx">Tipo de cambio (Gs. por dólar)</Label>
                    <Input id="expense-fx" type="number" inputMode="decimal" min={0} step="1" value={form.fxRatePyg} onChange={(e) => setForm({ ...form, fxRatePyg: e.target.value })} />
                  </div>
                )}

                {previewPyg > 0 && (
                  <p className="text-xs text-slate-500">
                    Equivale a {gs(previewPyg)}
                    {form.recurrence === 'yearly' ? ` por año (${gs(previewPyg / 12)} por mes)` : form.recurrence === 'monthly' ? ' por mes' : ''}.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="expense-start">{form.recurrence === 'one_time' ? 'Fecha' : 'Desde'}</Label>
                    <Input id="expense-start" type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} />
                  </div>
                  {form.recurrence !== 'one_time' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="expense-end">Hasta (opcional)</Label>
                      <Input id="expense-end" type="date" min={form.startsOn} value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expense-description">Nota (opcional)</Label>
                  <Textarea id="expense-description" rows={2} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="expense-active" className="cursor-pointer">
                    <span className="block text-sm font-medium">Activo</span>
                    <span className="block text-xs font-normal text-slate-500">Un gasto pausado no suma al costo.</span>
                  </Label>
                  <Switch id="expense-active" checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
                </div>
              </div>

              <SheetFooter className="px-4 pb-4">
                <Button variant="outline" onClick={() => setForm(null)} disabled={pending}>Cancelar</Button>
                <Button onClick={save} disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !pending && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete ? `Se borra "${toDelete.provider}" y deja de contar en los cálculos. Si solo dejó de aplicar, mejor pausalo o poné una fecha de fin.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                confirmDelete()
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
