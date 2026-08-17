import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'

export interface DebtItem {
  id: string
  type: 'repair' | 'installment'
  title: string
  subtitle?: string
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  dueDate?: string
  isOverdue: boolean
  status: string
  creditId?: string
}

/**
 * GET /api/customers/[id]/collect-payment
 * Devuelve todas las deudas pendientes del cliente (reparaciones + cuotas de créditos).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
    const organization = await getCurrentOrganizationContext(staffAuth.user.id)

    if (!organization) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 403 })
    }

    const { id: customerId } = await context.params
    const supabase = createAdminSupabase()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 1. Obtener Reparaciones con saldo pendiente
    const { data: rawRepairs } = await supabase
      .from('repairs')
      .select('id, ticket_number, device_brand, device_model, problem_description, status, final_cost, estimated_cost, paid_amount, payment_status, delivered_at, created_at')
      .eq('customer_id', customerId)
      .eq('organization_id', organization.id)

    const debtItems: DebtItem[] = []

    if (rawRepairs) {
      for (const r of rawRepairs) {
        const cost = Number(r.final_cost ?? r.estimated_cost ?? 0)
        const paid = Number(r.paid_amount ?? 0)
        const pending = Math.max(0, cost - paid)
        const isPaid = (r.payment_status || '').toLowerCase() === 'pagado' || (r.payment_status || '').toLowerCase() === 'paid'

        if (pending > 0 && !isPaid && cost > 0) {
          const isDelivered = (r.status || '').toLowerCase() === 'entregado' || Boolean(r.delivered_at)
          debtItems.push({
            id: r.id,
            type: 'repair',
            title: `Reparación #${r.ticket_number || r.id.slice(-6)}`,
            subtitle: [r.device_brand, r.device_model].filter(Boolean).join(' ') || r.problem_description || 'Servicio técnico',
            totalAmount: cost,
            paidAmount: paid,
            pendingAmount: pending,
            dueDate: r.created_at,
            isOverdue: isDelivered, // Si ya fue entregado y no se pagó, se considera prioritario
            status: r.status || 'En taller',
          })
        }
      }
    }

    // 2. Obtener Créditos y sus Cuotas pendientes
    const { data: rawCredits } = await supabase
      .from('customer_credits')
      .select('id, principal, status, created_at')
      .eq('customer_id', customerId)

    if (rawCredits && rawCredits.length > 0) {
      const creditIds = rawCredits.map((c) => c.id)
      const { data: rawInstallments } = await supabase
        .from('credit_installments')
        .select('id, credit_id, installment_number, due_date, amount, amount_paid, status')
        .in('credit_id', creditIds)
        .order('due_date', { ascending: true })

      if (rawInstallments) {
        for (const inst of rawInstallments) {
          const amount = Number(inst.amount || 0)
          const paid = Number(inst.amount_paid || 0)
          const pending = Math.max(0, amount - paid)
          const isPaid = inst.status === 'paid' || pending <= 0

          if (!isPaid && amount > 0) {
            const dueDateObj = inst.due_date ? new Date(inst.due_date) : null
            const isLate = inst.status === 'late' || (dueDateObj ? dueDateObj < today : false)

            debtItems.push({
              id: inst.id,
              type: 'installment',
              title: `Crédito #${inst.credit_id.slice(-6)} - Cuota ${inst.installment_number || ''}`,
              subtitle: dueDateObj ? `Vence: ${dueDateObj.toLocaleDateString('es-PY')}` : 'Cuota de crédito',
              totalAmount: amount,
              paidAmount: paid,
              pendingAmount: pending,
              dueDate: inst.due_date || undefined,
              isOverdue: isLate,
              status: isLate ? 'Vencida' : 'Pendiente',
              creditId: inst.credit_id,
            })
          }
        }
      }
    }

    // 3. Saldo a favor disponible
    let storeBalance = 0
    const { data: movements } = await supabase
      .from('customer_store_credit_movements')
      .select('amount')
      .eq('customer_id', customerId)
      .eq('organization_id', organization.id)

    if (movements) {
      storeBalance = movements.reduce((acc, m) => acc + Number(m.amount || 0), 0)
    }

    // Ordenar deudas por prioridad contable FIFO:
    // 1. Reparaciones entregadas / vencidas
    // 2. Cuotas vencidas (más antiguas primero)
    // 3. Otras reparaciones
    // 4. Cuotas por vencer (más próximas primero)
    debtItems.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1
      if (!a.isOverdue && b.isOverdue) return 1
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      return 0
    })

    const totalDebt = debtItems.reduce((acc, d) => acc + d.pendingAmount, 0)
    const overdueDebt = debtItems.filter((d) => d.isOverdue).reduce((acc, d) => acc + d.pendingAmount, 0)

    return NextResponse.json({
      success: true,
      debts: debtItems,
      totalDebt,
      overdueDebt,
      storeBalance,
    })
  } catch (error) {
    console.error('[GET /api/customers/[id]/collect-payment] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener deudas del cliente' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/[id]/collect-payment
 * Registra un cobro unificado / abono global distribuyendo el monto en las obligaciones.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
    const organization = await getCurrentOrganizationContext(staffAuth.user.id)

    if (!organization) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 403 })
    }

    const { id: customerId } = await context.params
    const body = await request.json().catch(() => ({}))
    const totalAmount = Number(body.amount || 0)
    const paymentMethod = String(body.paymentMethod || 'cash').toLowerCase()
    const bankName = typeof body.bankName === 'string' ? body.bankName.trim() : undefined
    const referenceNumber = typeof body.referenceNumber === 'string' ? body.referenceNumber.trim() : undefined
    const cardType = body.cardType === 'credit' ? 'credit' : 'debit'
    const posNetwork = typeof body.posNetwork === 'string' ? body.posNetwork.trim() : undefined
    const voucherNumber = typeof body.voucherNumber === 'string' ? body.voucherNumber.trim() : undefined
    const lastFourDigits = typeof body.lastFourDigits === 'string' ? body.lastFourDigits.trim() : undefined
    const mode = (body.mode === 'manual' ? 'manual' : 'auto') as 'auto' | 'manual'
    const manualAllocations = (body.allocations || []) as Array<{ id: string; type: 'repair' | 'installment'; amount: number }>
    const rawNotes = typeof body.notes === 'string' ? body.notes.trim() : ''

    const transferDetailsText = paymentMethod === 'transfer' && (bankName || referenceNumber)
      ? ` [Transf: ${[bankName, referenceNumber ? `Ref #${referenceNumber}` : ''].filter(Boolean).join(' - ')}]`
      : ''
    const cardDetailsText = paymentMethod === 'card'
      ? ` [Tarjeta ${cardType === 'credit' ? 'Crédito' : 'Débito'}${posNetwork ? ` - ${posNetwork}` : ''}${voucherNumber ? ` Cupón #${voucherNumber}` : ''}${lastFourDigits ? ` Term: ${lastFourDigits}` : ''}]`
      : ''
    const notes = `${rawNotes}${transferDetailsText}${cardDetailsText}`.trim()

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json({ error: 'El monto a abonar debe ser mayor a 0.' }, { status: 400 })
    }

    const supabase = createAdminSupabase()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 1. Obtener deudas frescas para aplicar el pago de forma segura
    const { data: rawRepairs } = await supabase
      .from('repairs')
      .select('id, ticket_number, device_brand, device_model, status, final_cost, estimated_cost, paid_amount, payment_status, delivered_at, created_at')
      .eq('customer_id', customerId)
      .eq('organization_id', organization.id)

    const debtItems: DebtItem[] = []

    if (rawRepairs) {
      for (const r of rawRepairs) {
        const cost = Number(r.final_cost ?? r.estimated_cost ?? 0)
        const paid = Number(r.paid_amount ?? 0)
        const pending = Math.max(0, cost - paid)
        const isPaid = (r.payment_status || '').toLowerCase() === 'pagado' || (r.payment_status || '').toLowerCase() === 'paid'

        if (pending > 0 && !isPaid && cost > 0) {
          const isDelivered = (r.status || '').toLowerCase() === 'entregado' || Boolean(r.delivered_at)
          debtItems.push({
            id: r.id,
            type: 'repair',
            title: `Reparación #${r.ticket_number || r.id.slice(-6)}`,
            subtitle: [r.device_brand, r.device_model].filter(Boolean).join(' '),
            totalAmount: cost,
            paidAmount: paid,
            pendingAmount: pending,
            dueDate: r.created_at,
            isOverdue: isDelivered,
            status: r.status || 'En taller',
          })
        }
      }
    }

    const { data: rawCredits } = await supabase
      .from('customer_credits')
      .select('id, principal, status, created_at')
      .eq('customer_id', customerId)

    if (rawCredits && rawCredits.length > 0) {
      const creditIds = rawCredits.map((c) => c.id)
      const { data: rawInstallments } = await supabase
        .from('credit_installments')
        .select('id, credit_id, installment_number, due_date, amount, amount_paid, status')
        .in('credit_id', creditIds)
        .order('due_date', { ascending: true })

      if (rawInstallments) {
        for (const inst of rawInstallments) {
          const amount = Number(inst.amount || 0)
          const paid = Number(inst.amount_paid || 0)
          const pending = Math.max(0, amount - paid)
          const isPaid = inst.status === 'paid' || pending <= 0

          if (!isPaid && amount > 0) {
            const dueDateObj = inst.due_date ? new Date(inst.due_date) : null
            const isLate = inst.status === 'late' || (dueDateObj ? dueDateObj < today : false)

            debtItems.push({
              id: inst.id,
              type: 'installment',
              title: `Crédito #${inst.credit_id.slice(-6)} - Cuota ${inst.installment_number || ''}`,
              subtitle: dueDateObj ? `Vence: ${dueDateObj.toLocaleDateString('es-PY')}` : 'Cuota',
              totalAmount: amount,
              paidAmount: paid,
              pendingAmount: pending,
              dueDate: inst.due_date || undefined,
              isOverdue: isLate,
              status: isLate ? 'Vencida' : 'Pendiente',
              creditId: inst.credit_id,
            })
          }
        }
      }
    }

    // Ordenar deudas por prioridad contable FIFO
    debtItems.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1
      if (!a.isOverdue && b.isOverdue) return 1
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      return 0
    })

    // 2. Calcular la distribución
    const appliedAllocations: Array<{
      id: string
      type: 'repair' | 'installment'
      title: string
      allocatedAmount: number
      previousPending: number
      newPending: number
      fullyPaid: boolean
    }> = []

    let remainingFunds = totalAmount

    if (mode === 'auto') {
      for (const debt of debtItems) {
        if (remainingFunds <= 0) break
        const alloc = Math.min(remainingFunds, debt.pendingAmount)
        if (alloc > 0) {
          const newPending = Math.max(0, debt.pendingAmount - alloc)
          appliedAllocations.push({
            id: debt.id,
            type: debt.type,
            title: debt.title,
            allocatedAmount: alloc,
            previousPending: debt.pendingAmount,
            newPending,
            fullyPaid: newPending === 0,
          })
          remainingFunds -= alloc
        }
      }
    } else {
      // Manual allocations
      const manualMap = new Map(manualAllocations.map((m) => [m.id, Number(m.amount || 0)]))
      for (const debt of debtItems) {
        const requestedAlloc = manualMap.get(debt.id) || 0
        if (requestedAlloc > 0 && remainingFunds > 0) {
          const alloc = Math.min(requestedAlloc, debt.pendingAmount, remainingFunds)
          if (alloc > 0) {
            const newPending = Math.max(0, debt.pendingAmount - alloc)
            appliedAllocations.push({
              id: debt.id,
              type: debt.type,
              title: debt.title,
              allocatedAmount: alloc,
              previousPending: debt.pendingAmount,
              newPending,
              fullyPaid: newPending === 0,
            })
            remainingFunds -= alloc
          }
        }
      }
    }

    const excessToStoreCredit = Math.max(0, remainingFunds)
    const nowIso = new Date().toISOString()
    const receiptNumber = `REC-${Date.now().toString().slice(-6)}`

    // 3. Ejecutar las actualizaciones en la base de datos
    for (const item of appliedAllocations) {
      if (item.type === 'repair') {
        const debtRef = debtItems.find((d) => d.id === item.id)
        if (debtRef) {
          const newTotalPaid = debtRef.paidAmount + item.allocatedAmount
          const newStatus = newTotalPaid >= debtRef.totalAmount ? 'pagado' : 'parcial'

          await supabase
            .from('repairs')
            .update({
              paid_amount: newTotalPaid,
              payment_status: newStatus,
              updated_at: nowIso,
            })
            .eq('id', item.id)
            .eq('organization_id', organization.id)
        }
      } else if (item.type === 'installment') {
        const debtRef = debtItems.find((d) => d.id === item.id)
        if (debtRef && debtRef.creditId) {
          const newTotalPaid = debtRef.paidAmount + item.allocatedAmount
          const isFullyPaid = newTotalPaid >= debtRef.totalAmount
          const newStatus = isFullyPaid ? 'paid' : (debtRef.isOverdue ? 'late' : 'pending')

          // Actualizar cuota
          await supabase
            .from('credit_installments')
            .update({
              amount_paid: newTotalPaid,
              status: newStatus,
              paid_at: isFullyPaid ? nowIso : null,
              payment_method: paymentMethod,
            })
            .eq('id', item.id)

          // Registrar en credit_payments
          await supabase
            .from('credit_payments')
            .insert({
              credit_id: debtRef.creditId,
              installment_id: item.id,
              amount: item.allocatedAmount,
              payment_method: paymentMethod,
              created_at: nowIso,
            })

          // Verificar si todas las cuotas de este crédito ya fueron pagadas para marcarlo como completed
          const { data: allInst } = await supabase
            .from('credit_installments')
            .select('status')
            .eq('credit_id', debtRef.creditId)

          if (allInst && allInst.every((i) => i.status === 'paid')) {
            await supabase
              .from('customer_credits')
              .update({ status: 'completed' })
              .eq('id', debtRef.creditId)
          }
        }
      }
    }

    // 4. Si hubo excedente, acreditar a la billetera de saldo a favor
    if (excessToStoreCredit > 0) {
      await supabase
        .from('customer_store_credit_movements')
        .insert({
          customer_id: customerId,
          organization_id: organization.id,
          amount: excessToStoreCredit,
          reason: `Excedente de abono a cuenta #${receiptNumber}`,
          source_type: 'manual',
          created_by: staffAuth.user.id,
          created_at: nowIso,
        })
    }

    return NextResponse.json({
      success: true,
      receiptNumber,
      totalAmount,
      appliedAllocations,
      excessToStoreCredit,
      paymentMethod,
      bankName: bankName || null,
      referenceNumber: referenceNumber || null,
      cardType: paymentMethod === 'card' ? cardType : null,
      posNetwork: posNetwork || null,
      voucherNumber: voucherNumber || null,
      lastFourDigits: lastFourDigits || null,
      timestamp: nowIso,
      message: `Abono de ${totalAmount.toLocaleString('es-PY')} Gs aplicado con éxito.`,
    })
  } catch (error) {
    console.error('[POST /api/customers/[id]/collect-payment] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar el abono a cuenta' },
      { status: 500 }
    )
  }
}
