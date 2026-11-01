import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import {
  cancelTransferRequest,
  createTransferRequest,
  fetchTransferOverview,
  TRANSFER_STATUS_LABEL,
  uploadTransferReceipt,
  type TransferOverview,
  type TransferRequest,
} from '@/lib/subscription-transfers';

const RECEIPT_MAX_BYTES = 3 * 1024 * 1024;

/**
 * Pago por transferencia desde la app: generar la solicitud, ver los datos
 * bancarios, subir la foto del comprobante y cancelar si se eligió mal el plan.
 */
export function SubscriptionTransferCard({ onChanged }: { onChanged?: () => void }) {
  const colors = usePalette();
  const [overview, setOverview] = useState<TransferOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [operationReference, setOperationReference] = useState('');

  const load = useCallback(() => {
    fetchTransferOverview()
      .then((next) => {
        setOverview(next);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar las transferencias.'));
  }, []);

  useEffect(load, [load]);

  const replace = (request: TransferRequest) => {
    setOverview((prev) => prev && { ...prev, requests: [request, ...prev.requests.filter((item) => item.id !== request.id)] });
    onChanged?.();
  };

  const run = async (action: () => Promise<TransferRequest>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      replace(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  };

  const pickReceipt = async (request: TransferRequest) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Sin acceso a tus fotos', 'Habilitá el acceso a la galería en los ajustes del teléfono para elegir el comprobante.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > RECEIPT_MAX_BYTES) {
      Alert.alert('Imagen muy pesada', 'Elegí una imagen de hasta 3 MB.');
      return;
    }
    await run(() => uploadTransferReceipt(request.id, { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName }, operationReference));
    setOperationReference('');
  };

  const confirmCancel = (request: TransferRequest) => {
    Alert.alert('Cancelar solicitud', `¿Cancelar la transferencia de ${formatGs(request.amount)} por ${request.plan_name}?`, [
      { text: 'Volver', style: 'cancel' },
      { text: 'Cancelar solicitud', style: 'destructive', onPress: () => void run(() => cancelTransferRequest(request.id)) },
    ]);
  };

  const shareBankData = (request: TransferRequest) => {
    const bank = request.bank_snapshot;
    const lines = [
      bank.bankName && `Banco: ${bank.bankName}`,
      bank.accountHolder && `Titular: ${bank.accountHolder}`,
      bank.accountNumber && `Cuenta: ${bank.accountNumber}`,
      bank.accountAlias && `Alias: ${bank.accountAlias}`,
      `Importe: ${formatGs(request.amount)}`,
      `Referencia: ${request.reference}`,
    ].filter(Boolean);
    void Share.share({ message: lines.join('\n') });
  };

  const open = overview?.requests.find((r) => r.status === 'awaiting_receipt' || r.status === 'pending_review');
  const latest = overview?.requests.find((r) => r.status === 'approved' || r.status === 'rejected');

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconChip, { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
          <Ionicons name="business-outline" size={16} color={palette.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>Transferencia bancaria</Text>
          <Text style={[styles.small, { color: colors.muted }]}>El plan se actualiza cuando aprobamos el comprobante.</Text>
        </View>
      </View>

      {error && <Text style={[styles.small, { color: palette.danger }]}>{error}</Text>}
      {!overview && !error && <ActivityIndicator color={palette.primary} />}

      {overview && !overview.enabled && (
        <Text style={[styles.small, { color: colors.muted }]}>El pago por transferencia no está disponible en este momento.</Text>
      )}

      {overview?.enabled && !open && (
        overview.plans.length === 0 ? (
          <Text style={[styles.small, { color: colors.muted }]}>No hay planes disponibles para pagar por transferencia.</Text>
        ) : (
          <View style={styles.gap}>
            <Text style={[styles.label, { color: colors.text }]}>Generar una solicitud para un mes</Text>
            {overview.plans.map((plan) => (
              <Pressable
                key={plan.code}
                disabled={busy}
                onPress={() => void run(() => createTransferRequest(plan.code))}
                style={[styles.option, { borderColor: colors.border, opacity: busy ? 0.6 : 1 }]}>
                <Text style={[styles.bold, { color: colors.text }]}>{plan.name}</Text>
                <Text style={[styles.bold, { color: palette.primary }]}>{formatGs(plan.price)}</Text>
              </Pressable>
            ))}
          </View>
        )
      )}

      {open && (
        <View style={[styles.request, { borderColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.bold, { color: colors.text }]}>{open.plan_name} · {formatGs(open.amount)}</Text>
            <Text style={[styles.badge, { color: palette.primary }]}>{TRANSFER_STATUS_LABEL[open.status]}</Text>
          </View>
          <Text selectable style={[styles.small, { color: colors.muted }]}>Referencia: {open.reference}</Text>

          {open.status === 'awaiting_receipt' ? (
            <>
              <View style={[styles.bankBox, { backgroundColor: colors.background }]}>
                {([
                  ['Banco', open.bank_snapshot.bankName],
                  ['Titular', open.bank_snapshot.accountHolder],
                  ['Cuenta', open.bank_snapshot.accountNumber],
                  ['Alias', open.bank_snapshot.accountAlias],
                ] as const).filter(([, value]) => Boolean(value)).map(([label, value]) => (
                  <View key={label} style={styles.rowBetween}>
                    <Text style={[styles.small, { color: colors.muted }]}>{label}</Text>
                    <Text selectable style={[styles.bold, { color: colors.text }]}>{value}</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.small, { color: colors.muted }]}>
                1. Transferí exactamente el importe.  2. Poné la referencia en el concepto.  3. Subí la foto del comprobante.
              </Text>
              <Pressable onPress={() => shareBankData(open)} style={[styles.linkBtn]}>
                <Ionicons name="share-outline" size={15} color={palette.primary} />
                <Text style={[styles.bold, { color: palette.primary }]}>Compartir datos para transferir</Text>
              </Pressable>
              <TextInput
                value={operationReference}
                onChangeText={setOperationReference}
                placeholder="Referencia de la operación bancaria (opcional)"
                placeholderTextColor={colors.muted}
                maxLength={160}
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              />
              <Pressable
                disabled={busy}
                onPress={() => void pickReceipt(open)}
                style={[styles.primaryBtn, { opacity: busy ? 0.6 : 1 }]}>
                <Ionicons name="image-outline" size={16} color="#fff" />
                <Text style={styles.primaryText}>{busy ? 'Enviando…' : 'Subir foto del comprobante'}</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={() => confirmCancel(open)} style={styles.linkBtn}>
                <Text style={[styles.bold, { color: colors.muted }]}>Cancelar solicitud</Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.small, { color: colors.muted }]}>
              Recibimos el comprobante y lo estamos revisando. Te avisamos por correo.
            </Text>
          )}
        </View>
      )}

      {latest && !open && (
        <Text style={[styles.small, { color: latest.status === 'rejected' ? palette.danger : palette.success }]}>
          Última transferencia: {TRANSFER_STATUS_LABEL[latest.status]}
          {latest.status === 'rejected' && latest.rejection_reason ? ` — ${latest.rejection_reason}` : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconChip: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700' },
  small: { fontSize: 12, lineHeight: 17 },
  bold: { fontSize: 13, fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '800' },
  option: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between' },
  request: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  bankBox: { borderRadius: 10, padding: 10, gap: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 11,
  },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
});
