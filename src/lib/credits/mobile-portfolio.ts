import { creditInstallmentIsOverdue } from './calendar';
export type PortfolioCustomerGroup = {
    customerId: string;
    name: string;
    installmentCount: number;
    creditCount: number;
    outstanding: number;
    overdue: number;
    nextDueDate: string | null;
};
export function groupCreditPortfolio(credits: Record<string, unknown>[], installments: Record<string, unknown>[], timeZone: string) { const parents = new Map(credits.map(row => [String(row.id), row])); const result = new Map<string, PortfolioCustomerGroup & {
    creditIds: Set<string>;
}>(); for (const row of installments) {
    const parent = parents.get(String(row.credit_id));
    if (!parent)
        continue;
    const customerId = String(parent.customer_id);
    const group = result.get(customerId) ?? { customerId, name: String(parent.customer_name ?? 'Cliente'), installmentCount: 0, creditCount: 0, outstanding: 0, overdue: 0, nextDueDate: null, creditIds: new Set<string>() };
    const remaining = parent.status === 'completed' || row.status === 'paid' ? 0 : Math.max(0, Number(row.amount) - Number(row.amount_paid ?? 0));
    if (!Number.isFinite(remaining))
        throw new Error('Saldo de cartera inválido.');
    group.installmentCount++;
    group.creditIds.add(String(row.credit_id));
    group.outstanding += remaining;
    if (creditInstallmentIsOverdue(String(row.due_date), String(row.status), timeZone))
        group.overdue += remaining;
    if (remaining > 0 && (!group.nextDueDate || String(row.due_date) < group.nextDueDate))
        group.nextDueDate = String(row.due_date);
    result.set(customerId, group);
} return [...result.values()].map(({ creditIds, ...group }) => ({ ...group, creditCount: creditIds.size, outstanding: Math.round(group.outstanding * 100) / 100, overdue: Math.round(group.overdue * 100) / 100 })).sort((a, b) => b.overdue - a.overdue || (a.nextDueDate ?? '9999').localeCompare(b.nextDueDate ?? '9999') || a.customerId.localeCompare(b.customerId)); }
