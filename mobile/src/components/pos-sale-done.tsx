import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { lineTotal, receiptText } from '@/lib/pos';
import { FREQUENCY_LABEL, shortDate } from '@/lib/pos-credit';
import { printReceipt, rememberPaper, saleNumber, savedPaper, shareReceiptPdf, type PaperFormat, type SaleReceipt } from '@/lib/pos-receipt';

type Colors = ReturnType<typeof usePalette>;

const PAPERS: { key: PaperFormat; label: string }[] = [
  { key: '58mm', label: 'Ticket 58 mm' },
  { key: '80mm', label: 'Ticket 80 mm' },
  { key: 'A4', label: 'Hoja A4' },
];

/**
 * Venta cobrada: el comprobante a la vista, para imprimir (térmica o común),
 * compartir en PDF o mandar por WhatsApp, y empezar la venta siguiente.
 */
export function PosSaleDone({ receipt, autoPrint, onNewSale }: { receipt: SaleReceipt; autoPrint: boolean; onNewSale: () => void }) {
  const colors = usePalette();
  const [paper, setPaper] = useState<PaperFormat>('80mm');
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoPrinted = useRef(false);

  const print = (format: PaperFormat) => {
    setBusy('print');
    setError(null);
    printReceipt(receipt, format)
      .catch((err) => setError(err instanceof Error && err.message ? `No se pudo imprimir: ${err.message}` : 'No se pudo imprimir.'))
      .finally(() => setBusy(null));
  };

  useEffect(() => {
    savedPaper().then((format) => {
      setPaper(format);
      // Impresión automática una sola vez, con el papel que usa este teléfono.
      if (autoPrint && !autoPrinted.current) {
        autoPrinted.current = true;
        print(format);
      }
    });
    // Solo al mostrar la venta: no se vuelve a imprimir si cambia algo después.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choosePaper = (format: PaperFormat) => {
    void Haptics.selectionAsync();
    setPaper(format);
    void rememberPaper(format);
  };

  const sharePdf = () => {
    setBusy('pdf');
    setError(null);
    shareReceiptPdf(receipt, paper)
      .catch((err) => setError(err instanceof Error && err.message ? err.message : 'No se pudo generar el PDF.'))
      .finally(() => setBusy(null));
  };

  const plan = receipt.credit?.plan;
  const shareText = () =>
    Share.share({
      message: [
        receiptText({
        business: receipt.business.name,
        lines: receipt.lines,
        priceMode: receipt.priceMode,
        totals: receipt.totals,
        payments: receipt.payments,
        change: receipt.change,
        saleId: receipt.saleId,
        customerName: receipt.customer?.name,
        }),
        plan
          ? ['', `*Plan de cuotas: ${formatGs(plan.financedTotal)}*`, ...plan.installments.map((row) => `${row.number}. ${shortDate(row.dueDate)} — ${formatGs(row.amount)}`)].join('\n')
          : '',
      ].join('\n'),
    });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={[styles.doneIcon, { backgroundColor: '#16A34A1A' }]}>
          <Ionicons name="checkmark-circle" size={58} color="#16A34A" />
        </View>
        <Text style={[styles.h1, { color: colors.text }]}>{plan ? '¡Venta a crédito registrada!' : '¡Venta cobrada!'}</Text>
        <Text style={[styles.total, { color: colors.text }]}>{formatGs(receipt.totals.total)}</Text>
        {receipt.change > 0 && (
          <View style={[styles.change, { backgroundColor: '#16A34A14' }]}>
            <Text style={styles.changeText}>Vuelto {formatGs(receipt.change)}</Text>
          </View>
        )}
        {receipt.points ? <Text style={[styles.small, { color: colors.muted }]}>+{receipt.points} puntos de fidelidad</Text> : null}
      </View>

      <ReceiptPreview receipt={receipt} colors={colors} />

      {plan && receipt.credit && (
        <View style={[styles.ticket, { backgroundColor: colors.card, borderColor: '#2563EB55' }]}>
          <Text style={[styles.ticketBiz, { color: colors.text }]}>Plan de cuotas</Text>
          <Text style={[styles.small, styles.center, { color: colors.muted }]}>
            {plan.installments.length} {plan.installments.length === 1 ? 'cuota' : 'cuotas'} {FREQUENCY_LABEL[receipt.credit.terms.frequency].toLowerCase()} · total {formatGs(plan.financedTotal)}
          </Text>
          <View style={[styles.dash, { borderColor: colors.border }]} />
          {plan.installments.slice(0, 6).map((row) => (
            <View key={row.number} style={styles.ticketRow}>
              <Text style={[styles.small, { color: colors.text }]}>
                Cuota {row.number} · {shortDate(row.dueDate)}
                {row.number === 1 && receipt.credit?.terms.firstPayment ? ' · pagada' : ''}
              </Text>
              <Text style={[styles.small, { color: colors.text, fontWeight: '700' }]}>{formatGs(row.amount)}</Text>
            </View>
          ))}
          {plan.installments.length > 6 && <Text style={[styles.tiny, { color: colors.muted }]}>y {plan.installments.length - 6} cuotas más (en el comprobante impreso)</Text>}
        </View>
      )}

      <Text style={[styles.label, { color: colors.text }]}>Papel</Text>
      <View style={styles.papers}>
        {PAPERS.map((item) => {
          const selected = paper === item.key;
          return (
            <Pressable key={item.key} onPress={() => choosePaper(item.key)} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.paper, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.08)' : colors.card }]}>
              <Text style={[styles.paperText, { color: selected ? palette.primary : colors.text }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable onPress={() => print(paper)} disabled={busy !== null} style={[styles.primary, { opacity: busy ? 0.7 : 1 }]}>
        {busy === 'print' ? <ActivityIndicator color="#fff" /> : <Ionicons name="print-outline" size={20} color="#fff" />}
        <Text style={styles.primaryText}>Imprimir comprobante</Text>
      </Pressable>
      <View style={styles.pair}>
        <Pressable onPress={sharePdf} disabled={busy !== null} style={[styles.secondary, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {busy === 'pdf' ? <ActivityIndicator color={palette.primary} /> : <Ionicons name="document-outline" size={18} color={palette.primary} />}
          <Text style={[styles.secondaryText, { color: colors.text }]}>Compartir PDF</Text>
        </Pressable>
        <Pressable onPress={shareText} style={[styles.secondary, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
          <Text style={[styles.secondaryText, { color: colors.text }]}>Enviar texto</Text>
        </Pressable>
      </View>
      <Pressable onPress={onNewSale} style={[styles.newSale, { borderColor: palette.primary }]}>
        <Ionicons name="add-circle-outline" size={20} color={palette.primary} />
        <Text style={[styles.newSaleText, { color: palette.primary }]}>Nueva venta</Text>
      </Pressable>
      <Text style={[styles.hint, { color: colors.muted }]}>
        Para la impresora térmica Bluetooth, instalá su app o un servicio de impresión (por ejemplo RawBT) y elegila en el diálogo de impresión.
      </Text>
    </ScrollView>
  );
}

function ReceiptPreview({ receipt, colors }: { receipt: SaleReceipt; colors: Colors }) {
  const lines = receipt.lines.slice(0, 6);
  return (
    <View style={[styles.ticket, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.ticketBiz, { color: colors.text }]}>{receipt.business.name}</Text>
      <Text style={[styles.tiny, styles.center, { color: colors.muted }]}>
        N.º {saleNumber(receipt.saleId)} · {receipt.date.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
      </Text>
      {receipt.customer && (
        <Text style={[styles.small, styles.center, { color: colors.text }]}>
          {receipt.customer.name}
          {receipt.customer.ruc ? ` · ${receipt.customer.ruc}` : ''}
        </Text>
      )}
      <View style={[styles.dash, { borderColor: colors.border }]} />
      {lines.map((line) => (
        <View key={line.product.id} style={styles.ticketRow}>
          <Text numberOfLines={1} style={[styles.small, styles.flex, { color: colors.text }]}>
            {line.quantity} × {line.product.name}
          </Text>
          <Text style={[styles.small, { color: colors.text, fontWeight: '700' }]}>{formatGs(lineTotal(line, receipt.priceMode))}</Text>
        </View>
      ))}
      {receipt.lines.length > lines.length && <Text style={[styles.tiny, { color: colors.muted }]}>y {receipt.lines.length - lines.length} productos más</Text>}
      <View style={[styles.dash, { borderColor: colors.border }]} />
      <View style={styles.ticketRow}>
        <Text style={[styles.ticketTotal, { color: colors.text }]}>TOTAL</Text>
        <Text style={[styles.ticketTotal, { color: colors.text }]}>{formatGs(receipt.totals.total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  hero: { alignItems: 'center', gap: 6, paddingTop: 8 },
  doneIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 21, fontWeight: '800' },
  total: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  change: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  changeText: { color: '#16A34A', fontSize: 16, fontWeight: '900' },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  label: { fontSize: 13, fontWeight: '800' },
  ticket: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  ticketBiz: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  dash: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 6 },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  ticketTotal: { fontSize: 15, fontWeight: '900' },
  papers: { flexDirection: 'row', gap: 8 },
  paper: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingVertical: 10 },
  paperText: { fontSize: 12, fontWeight: '800' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.primary, borderRadius: 14, minHeight: 54 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  pair: { flexDirection: 'row', gap: 10 },
  secondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 14, minHeight: 48 },
  secondaryText: { fontSize: 14, fontWeight: '800' },
  newSale: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 14, minHeight: 50 },
  newSaleText: { fontSize: 15, fontWeight: '900' },
  hint: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
