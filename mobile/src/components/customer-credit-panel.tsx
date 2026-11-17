import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from './bottom-sheet';
import { apiFetch } from '../lib/api';
import { getPrivateCacheContext } from '../lib/private-cache-context';
import { creditCode, type CreditRow, type InstallmentRow, type PaymentRow } from '../lib/customers';
import { creditDisplayDate,creditTotals, creditIsLate, formatCreditMoney } from '../lib/credit-model';
import { usePalette, palette } from '../lib/palette';
import { z } from 'zod';
import {sharePaymentReceiptPdf,printPaymentReceipt} from '../lib/payment-receipt';
type Credits = {
    credits: CreditRow[];
    installments: InstallmentRow[];
    payments: PaymentRow[];
    currency: string;
    timeZone: string;
};
const STATUS: Record<string, string> = { active: 'Activo', completed: 'Pagado', defaulted: 'En mora', cancelled: 'Anulado' };
const fileSchema = z.object({ status: z.enum(['draft', 'pending', 'approved', 'rejected', 'suspended']).nullable(), mode: z.string(), missing: z.array(z.string()), limit: z.number().finite().nonnegative(), outstanding: z.number().finite().nonnegative(), available: z.number().finite().nonnegative(), overdueCount: z.number().int().nonnegative(), eligible: z.boolean() });
export function CustomerCreditPanel({ data, error, customerId, customerName, onRetry, onCollect, canCollect }: {
    data: Credits | null;
    error: string | null;
    customerId: string;
    customerName: string;
    onRetry: () => void;
    onCollect: (id: string) => void;
    canCollect: boolean;
}) {
    const colors = usePalette(), [open, setOpen] = useState<string | null>(null), [file, setFile] = useState<z.infer<typeof fileSchema> | null>(null), [fileOpen, setFileOpen] = useState(false), [busy, setBusy] = useState(false), [fileError, setFileError] = useState<string | null>(null);
    const money = (value: number) => formatCreditMoney(value, data?.currency ?? '');
    const button = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, { borderColor: colors.border, backgroundColor: colors.card, opacity: disabled ? 0.45 : 1 }]}><Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text></Pressable>;
    async function expediente() { const epoch = getPrivateCacheContext().epoch; setBusy(true); setFileOpen(true); setFile(null); setFileError(null); try {
        const result = await apiFetch<{
            summary: unknown;
        }>('/api/customers/' + encodeURIComponent(customerId) + '/credit-file/summary');
        if (getPrivateCacheContext().epoch !== epoch)
            return;
        const parsed = fileSchema.safeParse(result.summary);
        if (!parsed.success)
            throw new Error('El resumen del expediente está incompleto. Reintentá.');
        setFile(parsed.data);
    }
    catch (error) {
        if (getPrivateCacheContext().epoch === epoch)
            setFileError(error instanceof Error ? error.message : 'No se pudo consultar el expediente.');
    }
    finally {
        if (getPrivateCacheContext().epoch === epoch)
            setBusy(false);
    } }
    async function receipt(payment: PaymentRow, print = false) { const epoch = getPrivateCacheContext().epoch; setBusy(true); try {
        const result = await apiFetch<{
            legacy?: boolean;
            collection?: unknown;
        }>('/api/credits/receipts?paymentId=' + encodeURIComponent(payment.id));
        if (getPrivateCacheContext().epoch !== epoch)
            return;
        if (result.legacy || !result.collection) {
            Alert.alert('Comprobante histórico no disponible', 'Este pago no tiene un comprobante guardado. El registro de pago sigue disponible en el historial.');
            return;
        }
        const saved = result.collection as {receipt?:unknown};
        if(print)await printPaymentReceipt(saved.receipt,epoch);else await sharePaymentReceiptPdf(saved.receipt, epoch);
    }
    catch (error) {
        Alert.alert('No se pudo abrir el comprobante', error instanceof Error ? error.message : 'Reintentá.');
    }
    finally {
        setBusy(false);
    } }
    function shareStatement(reminder = false) { if (!data)
        return; const rows = data.installments.filter(row => data.credits.some(c => c.id === row.credit_id && c.status !== 'cancelled')); const totals = creditTotals(rows); const lines = data.credits.filter(c => c.status !== 'cancelled').map(c => { const values = creditTotals(rows.filter(r => r.credit_id === c.id)); return creditCode(c) + ': financiado ' + money(values.total) + ' · pagado ' + money(values.paid) + ' · pendiente ' + money(values.pending); }); void Share.share({ message: [reminder ? 'Hola ' + customerName + ', te compartimos el saldo pendiente de tus créditos. Podés comunicarte con el comercio para coordinar el pago.' : 'Estado de cuenta · ' + customerName, ...lines, 'Saldo pendiente: ' + money(totals.pending), 'Consultado: ' + new Date().toLocaleString('es-PY', { timeZone: data.timeZone }), 'Resumen informativo, no acredita un pago.'].join('\n') }).catch(() => Alert.alert('No se pudo compartir', 'Volvé a intentar.')); }
    if (error)
        return <View style={styles.card}><Text accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Text>{button('Reintentar créditos', onRetry)}</View>;
    if (!data)
        return <ActivityIndicator color={palette.primary}/>;
    const pendingDue = creditTotals(data.installments.filter(row => data.credits.some(c => c.id === row.credit_id && c.status !== 'cancelled'))).pending;
    return <View style={{ gap: 14 }}><View style={styles.wrap}>{button('Estado de cuenta', () => shareStatement(), busy)}{button('Compartir recordatorio', () => shareStatement(true), busy || pendingDue <= 0)}{button('Expediente crediticio', () => { void expediente(); }, busy)}</View><Text style={{ color: colors.muted, fontSize: 12 }}>Ficha completa del cliente. El recordatorio se comparte manualmente: no se envía automáticamente.</Text>{!data.credits.length && <Text style={{ color: colors.text }}>Este cliente no tiene créditos registrados.</Text>}
 {data.credits.map(credit => {
            const installments = data.installments.filter(r => r.credit_id === credit.id).sort((a, b) => a.installment_number - b.installment_number);
            const values = creditTotals(installments), cancelled = credit.status === 'cancelled';
            const next = installments.find(r => r.status !== 'paid');
            return <View key={credit.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open === credit.id }} onPress={() => setOpen(open === credit.id ? null : credit.id)} style={styles.heading}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{creditCode(credit)}</Text><Text style={{ color: colors.muted }}>{STATUS[credit.status] ?? credit.status} · {credit.term_months} cuotas</Text></View><Ionicons name={open === credit.id ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted}/></Pressable><Text style={{ color: colors.muted }}>Capital: {money(Number(credit.principal))}</Text>{cancelled ? <Text style={{ color: colors.muted }}>Crédito anulado. No se presenta como pagado ni se habilita el cobro.</Text> : <><Text style={{ color: colors.muted }}>Intereses y ajustes sobre el capital: {money(values.total - Number(credit.principal))}</Text><Text style={{ color: colors.text }}>Total financiado: {money(values.total)} · Pagado: {money(values.paid)}</Text><Text style={{ color: values.pending ? colors.text : palette.success, fontSize: 24, fontWeight: '800' }}>Pendiente: {money(values.pending)}</Text>{next && <Text style={{ color: creditIsLate(next.due_date, next.status, data.timeZone) ? palette.danger : colors.muted }}>Próxima cuota: {creditDisplayDate(next.due_date,data.timeZone)}</Text>}</>}
 {open === credit.id && <>{installments.map(row => { const remaining = Math.max(0, Number(row.amount) - Number(row.amount_paid ?? 0)), late = creditIsLate(row.due_date, row.status, data.timeZone); return <View key={row.id} style={[styles.line, { borderColor: colors.border }]}><View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.text, fontWeight: '700' }}>Cuota {row.installment_number} · {money(row.status === 'paid' ? Number(row.amount) : remaining)}</Text><Text style={{ color: late ? palette.danger : colors.muted, fontSize: 12 }}>{row.status === 'paid' ? 'Pagada' : late ? 'Vencida' : 'Pendiente'} · {creditDisplayDate(row.due_date,data.timeZone)}</Text></View>{!cancelled && credit.status !== 'completed' && row.status !== 'paid' && remaining > 0 && canCollect && button('Cobrar', () => onCollect(row.id))}</View>; })}<Text style={{ color: colors.text, fontWeight: '700' }}>Historial de pagos</Text>{data.payments.filter(r => r.credit_id === credit.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(payment => <View key={payment.id} style={[styles.line, { borderColor: colors.border }]}><View style={{ flex: 1 }}><Text style={{ color: colors.text }}>{money(Number(payment.amount))}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{creditDisplayDate(payment.created_at,data.timeZone)}</Text></View><View style={{gap:6}}>{button('Imprimir', () => { void receipt(payment,true); }, busy)}{button('Compartir PDF', () => { void receipt(payment); }, busy)}</View></View>)}</>}
 </View>;
        })}
 <BottomSheet visible={fileOpen} title="Expediente crediticio" subtitle="Consulta informativa; las decisiones se conservan en el sistema." onClose={() => setFileOpen(false)}>{busy ? <ActivityIndicator color={palette.primary}/> : null}{fileError ? <Text accessibilityRole="alert" style={{ color: palette.danger }}>{fileError}</Text> : null}{file && <><Text style={{ color: colors.text, fontWeight: '700' }}>Estado: {({ draft: 'Borrador', pending: 'Pendiente de revisión', approved: 'Aprobado', rejected: 'Rechazado', suspended: 'Suspendido' }[file.status ?? 'draft'])}</Text><Text style={{ color: colors.text }}>Límite: {money(file.limit)}</Text><Text style={{ color: colors.text }}>Utilizado: {money(file.outstanding)} · Disponible: {money(file.available)}</Text><Text style={{ color: colors.muted }}>Cuotas vencidas: {file.overdueCount}</Text><Text style={{ color: colors.muted }}>{file.eligible ? 'Cumple los requisitos del expediente. La venta aún debe pasar sus validaciones.' : 'Hay requisitos pendientes. Revisá el expediente desde la administración web.'}</Text></>}</BottomSheet>
 </View>;
}
const styles = StyleSheet.create({ card: { padding: 18, borderWidth: 1, borderRadius: 20, gap: 12 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: 'center' }, line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1 } });
