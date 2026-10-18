import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarcodeScanner } from './barcode-scanner';
import { apiFetch } from '@/lib/api';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

interface RepairTrackerModalProps {
  visible: boolean;
  onClose: () => void;
}

interface PublicRepairData {
  ticketNumber: string;
  device: string;
  brand: string;
  model: string;
  deviceType: string;
  issue: string;
  status: string;
  priority?: string;
  createdAt?: string;
  estimatedCompletion?: string | null;
  completedAt?: string | null;
  estimatedCost?: number;
  finalCost?: number | null;
  paidAmount?: number | null;
  paymentStatus?: string | null;
  warrantyMonths?: number;
  technician?: { name: string } | null;
  customer?: { name: string };
}

const STEPS = [
  { key: 'recibido', label: 'Recibido', icon: 'file-tray-full-outline' as const },
  { key: 'diagnostico', label: 'Diagnóstico', icon: 'search-outline' as const },
  { key: 'reparacion', label: 'En Taller', icon: 'construct-outline' as const },
  { key: 'listo', label: 'Listo', icon: 'checkmark-circle-outline' as const },
  { key: 'entregado', label: 'Entregado', icon: 'cube-outline' as const },
];

const STEP_INDEX: Record<string, number> = {
  recibido: 0,
  diagnostico: 1,
  reparacion: 2,
  pausado: 2,
  listo: 3,
  entregado: 4,
};

export function RepairTrackerModal({ visible, onClose }: RepairTrackerModalProps) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();

  const [ticketInput, setTicketInput] = useState('');
  const [contactInput, setContactInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [repair, setRepair] = useState<PublicRepairData | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const handleSearch = async (overrideTicket?: string) => {
    const ticketToSearch = (overrideTicket ?? ticketInput).trim();
    if (!ticketToSearch) {
      setErrorMsg('Ingresá el número de ticket o escaneá el comprobante.');
      return;
    }
    if (!contactInput.trim() && !overrideTicket) {
      setErrorMsg('Ingresá tu número de teléfono o documento de contacto.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const res = await apiFetch<{
        success: boolean;
        data?: { repair: PublicRepairData };
        error?: string;
      }>('/api/public/repairs/auth', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          ticketNumber: ticketToSearch,
          contact: contactInput.trim() || '0981000000',
        }),
      });

      if (res?.data?.repair) {
        setRepair(res.data.repair);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setErrorMsg(res?.error || 'No se encontró la reparación con los datos provistos.');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo consultar el ticket. Verificá los datos ingresados.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = (code: string) => {
    setShowScanner(false);
    setTicketInput(code);
    void handleSearch(code);
  };

  const currentStep = repair ? (STEP_INDEX[repair.status.toLowerCase()] ?? 0) : 0;
  const isCancelled = repair?.status?.toLowerCase() === 'cancelado';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar rastreador" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
                <Ionicons name="construct" size={20} color={palette.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>Seguimiento de Reparación</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  Consultá el estado de tu equipo en tiempo real
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* ── Formulario de Búsqueda ── */}
            <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Número de Ticket / Orden</Text>
              <View style={styles.inputWithScanner}>
                <TextInput
                  value={ticketInput}
                  onChangeText={(text) => {
                    setTicketInput(text);
                    setErrorMsg(null);
                  }}
                  placeholder="Ej: REP-2026-00042 o 1045"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  returnKeyType="next"
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
                <Pressable
                  onPress={() => setShowScanner(true)}
                  style={[styles.scannerBtn, { backgroundColor: palette.primary }]}>
                  <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.scannerBtnText}>Escanear</Text>
                </Pressable>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 10 }]}>
                Teléfono o Cédula de contacto
              </Text>
              <TextInput
                value={contactInput}
                onChangeText={(text) => {
                  setContactInput(text);
                  setErrorMsg(null);
                }}
                placeholder="Teléfono ingresado al dejar el equipo"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                returnKeyType="search"
                onSubmitEditing={() => handleSearch()}
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />

              {errorMsg ? (
                <View style={styles.errorAlert}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => handleSearch()}
                disabled={loading}
                style={[styles.searchBtn, { backgroundColor: palette.primary, opacity: loading ? 0.7 : 1 }]}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="search" size={18} color="#FFFFFF" />
                    <Text style={styles.searchBtnText}>Consultar Estado</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* ── Resultado del Ticket ── */}
            {repair && (
              <View style={[styles.resultCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.resultHeader}>
                  <View>
                    <Text style={[styles.ticketBadgeText, { color: palette.primary }]}>
                      Ticket #{repair.ticketNumber}
                    </Text>
                    <Text style={[styles.deviceName, { color: colors.text }]}>{repair.device}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      isCancelled
                        ? { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.3)' }
                        : { backgroundColor: 'rgba(16,185,129,0.14)', borderColor: 'rgba(16,185,129,0.3)' },
                    ]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: isCancelled ? '#EF4444' : '#10B981' },
                      ]}>
                      {repair.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* ── Stepper Visual ── */}
                {!isCancelled && (
                  <View style={styles.stepperContainer}>
                    <View style={styles.stepperRow}>
                      {STEPS.map((step, idx) => {
                        const isDone = idx <= currentStep;
                        const isCurrent = idx === currentStep;
                        return (
                          <View key={step.key} style={styles.stepItem}>
                            <View
                              style={[
                                styles.stepIconCircle,
                                isDone
                                  ? { backgroundColor: palette.primary }
                                  : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                              ]}>
                              <Ionicons
                                name={step.icon}
                                size={14}
                                color={isDone ? '#FFFFFF' : colors.muted}
                              />
                            </View>
                            <Text
                              style={[
                                styles.stepLabel,
                                {
                                  color: isCurrent ? palette.primary : isDone ? colors.text : colors.muted,
                                  fontWeight: isCurrent ? '800' : '600',
                                },
                              ]}>
                              {step.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* ── Detalles del Servicio ── */}
                <View style={[styles.detailsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {repair.issue ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: colors.muted }]}>Motivo / Falla:</Text>
                      <Text style={[styles.detailVal, { color: colors.text }]}>{repair.issue}</Text>
                    </View>
                  ) : null}

                  {repair.technician?.name ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: colors.muted }]}>Técnico Asignado:</Text>
                      <Text style={[styles.detailVal, { color: colors.text }]}>{repair.technician.name}</Text>
                    </View>
                  ) : null}

                  {repair.finalCost != null && repair.finalCost > 0 ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: colors.muted }]}>Costo Final:</Text>
                      <Text style={[styles.detailVal, { color: '#10B981', fontWeight: '800' }]}>
                        {formatGs(repair.finalCost)}
                      </Text>
                    </View>
                  ) : repair.estimatedCost != null && repair.estimatedCost > 0 ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: colors.muted }]}>Presupuesto Estimado:</Text>
                      <Text style={[styles.detailVal, { color: colors.text, fontWeight: '700' }]}>
                        {formatGs(repair.estimatedCost)}
                      </Text>
                    </View>
                  ) : null}

                  {repair.warrantyMonths != null && repair.warrantyMonths > 0 ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: colors.muted }]}>Garantía del Servicio:</Text>
                      <Text style={[styles.detailVal, { color: colors.text }]}>
                        {repair.warrantyMonths} mes{repair.warrantyMonths !== 1 ? 'es' : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Escáner de código de barras para el ticket */}
      <BarcodeScanner
        visible={showScanner}
        title="Escaneá el código del Ticket"
        onClose={() => setShowScanner(false)}
        onScanned={handleBarcodeScanned}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: 16,
  },
  searchBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputWithScanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  scannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  scannerBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 10,
    borderRadius: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    flex: 1,
    fontWeight: '600',
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    marginTop: 14,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  resultCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  ticketBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  deviceName: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stepperContainer: {
    paddingVertical: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  stepIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  detailsBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  detailKey: {
    fontSize: 12,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
});
