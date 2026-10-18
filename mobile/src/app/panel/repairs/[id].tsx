import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DeliverySheet } from '@/components/delivery-sheet';
import { CostsSheet, EditRepairSheet, PaymentSheet } from '@/components/repair-editors';
import { QualityCheckSheet } from '@/components/quality-check-sheet';
import { formatGs, openWeb } from '@/lib/marketplace';
import { usePanel } from '@/lib/panel';
import { palette, usePalette } from '@/lib/palette';
import {
  cachedRepair,
  changeRepairStatus,
  customerName,
  daysSince,
  DEVICE_ICONS,
  deviceName,
  money,
  NEXT_STATUSES,
  PRIORITY,
  QUALITY_RESULTS,
  QUALITY_ROLES,
  repairOutcome,
  STATUS,
  ticketOf,
  TIMELINE,
  updateCachedRepair,
  type Repair,
  type RepairStatus,
} from '@/lib/repairs';

type Colors = ReturnType<typeof usePalette>;

/** Teléfono para wa.me: solo dígitos y con 595 si viene en formato local (09xx). */
function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('595')) return digits;
  if (digits.startsWith('0')) return `595${digits.slice(1)}`;
  return digits;
}

export default function RepairDetail() {
  const colors = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [repair, setRepair] = useState<Repair | undefined>(() => (id ? cachedRepair(id) : undefined));
  const [target, setTarget] = useState<RepairStatus | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qcOpen, setQcOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [editor, setEditor] = useState<'edit' | 'costs' | 'payment' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { data: panel, can } = usePanel();

  const back = () => (router.canGoBack() ? router.back() : router.replace('/panel/repairs' as never));

  if (!repair) {
    return (
      <View style={styles.center}>
        <Ionicons name="search-outline" size={30} color={colors.muted} />
        <Text style={[styles.h2, { color: colors.text }]}>No encontramos la reparación</Text>
        <Pressable onPress={() => router.replace('/panel/repairs' as never)} style={[styles.outline, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Ir a reparaciones</Text>
        </Pressable>
      </View>
    );
  }

  const status = STATUS[repair.status] ?? STATUS.recibido;
  const { total, paid, balance, quoted } = money(repair);
  // «Listo» no se elige a mano: lo pone la verificación técnica, como en la web.
  const canVerify = can('repairs.orders.update') && QUALITY_ROLES.includes(panel?.organization.role ?? '') && (repair.status === 'reparacion' || repair.status === 'listo');
  const next = (NEXT_STATUSES[repair.status] ?? []).filter((stage) => stage !== 'listo');
  // Entregada o cancelada ya no se edita (la API rechaza cambios en una cancelada).
  const editable = repair.status !== 'entregado' && repair.status !== 'cancelado';
  const lastCheck = Array.isArray(repair.qualityCheck) ? repair.qualityCheck[0] : repair.qualityCheck;
  const lastCheckOption = QUALITY_RESULTS.find((item) => item.key === lastCheck?.result);
  const phone = repair.customer?.phone?.trim();
  const stepIndex = TIMELINE.indexOf(repair.status === 'pausado' ? 'reparacion' : repair.status);
  const priority = repair.priority ? PRIORITY[repair.priority] : null;
  const outcome = repairOutcome(repair);

  const openChange = (stage: RepairStatus) => {
    setError(null);
    setNote('');
    setTarget(stage);
  };

  const confirmChange = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await changeRepairStatus(repair.id, target, note);
      const merged = { ...repair, ...updated };
      setRepair(merged);
      updateCachedRepair(merged);
      setTarget(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const applyUpdate = (updated: Repair, message: string) => {
    const merged = { ...repair, ...updated };
    setRepair(merged);
    updateCachedRepair(merged);
    setEditor(null);
    setNotice(message);
  };

  const webDetail = `/dashboard/repairs?id=${encodeURIComponent(repair.id)}`;

  return (
    <View style={styles.flex}>
      {/* Barra superior del detalle */}
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Volver" style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={[styles.ticket, { color: colors.muted }]}>{ticketOf(repair)}</Text>
          <Text numberOfLines={1} style={[styles.topTitle, { color: colors.text }]}>{deviceName(repair)}</Text>
        </View>
        <Pressable onPress={() => openWeb(webDetail)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Abrir en la web" style={styles.iconBtn}>
          <Ionicons name="open-outline" size={21} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Estado y avance */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <View style={[styles.badge, { backgroundColor: `${status.color}1A` }]}>
              <Ionicons name={status.icon} size={14} color={status.color} />
              <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
            </View>
            <Text style={[styles.small, { color: colors.muted }]}>
              Ingresó hace {daysSince(repair.created_at)} {daysSince(repair.created_at) === 1 ? 'día' : 'días'}
            </Text>
          </View>
          {repair.status !== 'cancelado' && (
            <View style={styles.timeline}>
              {TIMELINE.map((step, index) => {
                const done = index <= stepIndex;
                const tone = done ? status.color : colors.border;
                return (
                  <View key={step} style={styles.step}>
                    <View style={styles.stepTrack}>
                      {index > 0 && <View style={[styles.stepLine, { backgroundColor: index <= stepIndex ? status.color : colors.border }]} />}
                      <View style={[styles.stepDot, { backgroundColor: done ? tone : colors.card, borderColor: tone }]}>
                        {done && <Ionicons name="checkmark" size={10} color="#fff" />}
                      </View>
                    </View>
                    <Text numberOfLines={1} style={[styles.stepLabel, { color: done ? colors.text : colors.muted }, index === stepIndex && styles.bold]}>
                      {STATUS[step].label.replace(' para retirar', '').replace('En reparación', 'Reparación')}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
          {outcome && (
            <View style={[styles.outcome, { borderColor: `${outcome.color}55`, backgroundColor: `${outcome.color}12` }]}>
              <Ionicons name="alert-circle-outline" size={16} color={outcome.color} />
              <Text style={[styles.outcomeText, { color: outcome.color }]}>
                {repair.status === 'entregado' ? `Entregado · ${outcome.label}` : outcome.label}
              </Text>
            </View>
          )}
          {repair.status === 'entregado' && repair.delivered_at && (
            <Text style={[styles.small, { color: colors.muted }]}>
              Entregado el {new Date(repair.delivered_at).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
          )}
          {repair.status === 'pausado' && (
            <Text style={[styles.small, { color: STATUS.pausado.color }]}>Pausada: posiblemente esperando repuestos o la aprobación del cliente.</Text>
          )}
        </View>

        {/* Acciones de estado */}
        {notice && (
          <View style={[styles.outcome, { borderColor: '#16A34A55', backgroundColor: '#16A34A12' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={[styles.outcomeText, styles.flex, { color: '#16A34A' }]}>{notice}</Text>
          </View>
        )}

        {(next.length > 0 || repair.status === 'listo' || canVerify) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Cambiar estado</Text>
            <View style={styles.actions}>
              {canVerify && (
                <Pressable
                  onPress={() => {
                    setNotice(null);
                    setQcOpen(true);
                  }}
                  accessibilityRole="button"
                  style={[styles.action, styles.actionPrimary, { backgroundColor: '#16A34A' }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                  <Text style={styles.actionPrimaryText}>
                    {repair.status === 'listo' ? 'Repetir verificación técnica' : 'Verificación técnica y marcar listo'}
                  </Text>
                </Pressable>
              )}
              {repair.status === 'listo' && can('repairs.orders.deliver') && (
                <Pressable
                  onPress={() => {
                    setNotice(null);
                    setDeliveryOpen(true);
                  }}
                  accessibilityRole="button"
                  style={[styles.action, styles.actionPrimary, { backgroundColor: '#0F172A' }]}>
                  <Ionicons name="bag-check-outline" size={18} color="#fff" />
                  <Text style={styles.actionPrimaryText}>Entregar equipo</Text>
                </Pressable>
              )}
              {next.filter(stage => can(stage === 'entregado' ? 'repairs.orders.deliver' : 'repairs.orders.update')).map((stage) => {
                const config = STATUS[stage];
                const destructive = stage === 'cancelado';
                return (
                  <Pressable
                    key={stage}
                    onPress={() => openChange(stage)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.action,
                      { borderColor: destructive ? `${config.color}66` : colors.border, backgroundColor: pressed ? colors.background : colors.card },
                    ]}>
                    <Ionicons name={config.icon} size={18} color={config.color} />
                    <Text style={[styles.actionText, { color: destructive ? config.color : colors.text }]}>
                      {destructive ? 'Cancelar orden' : `Pasar a ${config.label.toLowerCase()}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {repair.status === 'reparacion' && !canVerify && (
              <Text style={[styles.small, { color: colors.muted }]}>
                Para marcarlo listo, un técnico o un responsable tiene que hacer la verificación técnica.
              </Text>
            )}
            {lastCheckOption && (repair.status === 'listo' || repair.status === 'entregado') && (
              <View style={[styles.outcome, { borderColor: `${lastCheckOption.color}55`, backgroundColor: `${lastCheckOption.color}12` }]}>
                <Ionicons name={lastCheckOption.icon} size={16} color={lastCheckOption.color} />
                <Text style={[styles.outcomeText, { color: lastCheckOption.color }]}>Verificación: {lastCheckOption.label}</Text>
              </View>
            )}
          </View>
        )}

        {/* Equipo */}
        <Card
          title="Equipo"
          icon={DEVICE_ICONS[repair.device_type ?? ''] ?? 'hardware-chip-outline'}
          colors={colors}
          action={editable ? { label: 'Editar', icon: 'create-outline', onPress: () => setEditor('edit') } : undefined}>
          <Field label="Equipo" value={deviceName(repair)} colors={colors} />
          {repair.imei ? <Field label="IMEI" value={repair.imei} colors={colors} mono /> : null}
          {repair.serial_number ? <Field label="N.º de serie" value={repair.serial_number} colors={colors} mono /> : null}
          {priority ? <Field label="Prioridad" value={priority.label} colors={colors} tone={priority.color} /> : null}
          {repair.problem_description ? <Block label="Problema informado" value={repair.problem_description} colors={colors} /> : null}
          {repair.diagnosis ? <Block label="Diagnóstico" value={repair.diagnosis} colors={colors} /> : null}
        </Card>

        {/* Cliente */}
        <Card title="Cliente" icon="person-outline" colors={colors}>
          <Text style={[styles.customer, { color: colors.text }]}>{customerName(repair)}</Text>
          {phone ? <Text style={[styles.small, { color: colors.muted }]}>{phone}</Text> : null}
          {phone ? (
            <View style={styles.contactRow}>
              <Pressable onPress={() => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`)} style={[styles.contact, { borderColor: colors.border }]}>
                <Ionicons name="call-outline" size={18} color={colors.text} />
                <Text style={[styles.actionText, { color: colors.text }]}>Llamar</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(
                      `Hola ${customerName(repair)}, te escribimos por tu ${deviceName(repair)} (orden ${ticketOf(repair)}). Estado: ${status.label}.`
                    )}`
                  )
                }
                style={[styles.contact, { borderColor: '#16A34A66', backgroundColor: '#16A34A12' }]}>
                <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                <Text style={[styles.actionText, { color: '#16A34A' }]}>WhatsApp</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.small, { color: colors.muted }]}>Sin teléfono cargado.</Text>
          )}
        </Card>

        {/* Costos */}
        <Card
          title="Costos"
          icon="cash-outline"
          colors={colors}
          action={editable ? { label: quoted ? 'Editar precio' : 'Presupuestar', icon: 'pricetag-outline', onPress: () => setEditor('costs') } : undefined}>
          {quoted ? (
            <View style={styles.moneyRow}>
              <Money label={repair.final_cost != null ? 'Total' : 'Presupuesto'} value={formatGs(total)} colors={colors} />
              <Money label="Pagado" value={formatGs(paid)} colors={colors} />
              <Money label="Saldo" value={formatGs(balance)} colors={colors} tone={balance > 0 ? palette.danger : palette.success} />
            </View>
          ) : (
            <Text style={[styles.small, { color: colors.muted }]}>Todavía sin presupuesto.</Text>
          )}
          {(repair.parts?.length ?? 0) > 0 && (
            <View style={[styles.partsList, { borderColor: colors.border }]}>
              {repair.parts!.map((part) => (
                <View key={part.id} style={styles.partRow}>
                  <Text numberOfLines={1} style={[styles.small, styles.flex, { color: colors.text }]}>
                    {part.quantity} × {part.part_name}
                  </Text>
                  <Text style={[styles.small, { color: colors.muted }]}>
                    {part.line_type === 'included_material' ? 'Incluido' : formatGs(Number(part.unit_price) * Number(part.quantity))}
                  </Text>
                </View>
              ))}
              {Number(repair.labor_cost) > 0 && (
                <View style={styles.partRow}>
                  <Text style={[styles.small, styles.flex, { color: colors.text }]}>Mano de obra</Text>
                  <Text style={[styles.small, { color: colors.muted }]}>{formatGs(Number(repair.labor_cost))}</Text>
                </View>
              )}
            </View>
          )}
          {editable && (quoted ? balance > 0 : true) && (
            <Pressable onPress={() => setEditor('payment')} style={[styles.contact, { borderColor: '#16A34A66', backgroundColor: '#16A34A12' }]}>
              <Ionicons name="cash-outline" size={18} color="#16A34A" />
              <Text style={[styles.actionText, { color: '#16A34A' }]}>{quoted ? 'Registrar pago' : 'Registrar anticipo'}</Text>
            </Pressable>
          )}
        </Card>

        {/* Técnico */}
        <Card
          title="Técnico"
          icon="construct-outline"
          colors={colors}
          action={editable ? { label: repair.technician_id ? 'Cambiar' : 'Asignar', icon: 'person-add-outline', onPress: () => setEditor('edit') } : undefined}>
          <Text style={[styles.customer, { color: repair.technician?.full_name ? colors.text : colors.muted }]}>
            {repair.technician?.full_name ?? 'Sin técnico asignado'}
          </Text>
          {!repair.technician_id && (
            <Text style={[styles.small, { color: colors.muted }]}>Para pasar a reparación hace falta un técnico asignado.</Text>
          )}
        </Card>

        {/* Fotos */}
        {repair.images && repair.images.length > 0 && (
          <Card title={`Fotos (${repair.images.length})`} icon="images-outline" colors={colors}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
              {repair.images.map((image) => (
                <Image key={image.id} source={image.image_url} style={[styles.photo, { backgroundColor: colors.background }]} contentFit="cover" transition={150} />
              ))}
            </ScrollView>
          </Card>
        )}
      </ScrollView>

      {editor === 'edit' && (
        <EditRepairSheet repair={repair} visible onClose={() => setEditor(null)} onSaved={(updated) => applyUpdate(updated, 'Cambios guardados.')} />
      )}
      {editor === 'costs' && (
        <CostsSheet repair={repair} visible onClose={() => setEditor(null)} onSaved={(updated) => applyUpdate(updated, 'Costos guardados: el total y el saldo se recalcularon.')} />
      )}
      {editor === 'payment' && (
        <PaymentSheet repair={repair} visible onClose={() => setEditor(null)} onSaved={(updated) => applyUpdate(updated, 'Pago registrado.')} />
      )}

      <DeliverySheet
        repair={repair}
        visible={deliveryOpen}
        onClose={() => setDeliveryOpen(false)}
        onDelivered={(updated) => {
          const merged = { ...repair, ...updated };
          setRepair(merged);
          updateCachedRepair(merged);
          setDeliveryOpen(false);
          setNotice('Equipo entregado. Quedó registrado el cobro y la entrega.');
        }}
      />

      <QualityCheckSheet
        repair={repair}
        visible={qcOpen}
        onClose={() => setQcOpen(false)}
        onSaved={(updated, result) => {
          const merged = { ...repair, ...updated };
          setRepair(merged);
          updateCachedRepair(merged);
          setQcOpen(false);
          setNotice(
            result === 'failed'
              ? 'Falla registrada: el equipo vuelve a reparación.'
              : 'Verificación registrada: el equipo está listo para retiro.'
          );
        }}
      />

      {/* Confirmar cambio de estado */}
      <Modal visible={target !== null} transparent animationType="fade" onRequestClose={() => !saving && setTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !saving && setTarget(null)} />
          {target && (
            <View style={[styles.sheet, { backgroundColor: colors.card }]}>
              <Text style={[styles.h2, { color: colors.text }]}>
                {target === 'cancelado' ? '¿Cancelar la orden?' : `¿Pasar a ${STATUS[target].label.toLowerCase()}?`}
              </Text>
              <Text style={[styles.small, { color: colors.muted }]}>
                {ticketOf(repair)} · {deviceName(repair)}. Queda registrado en el historial.
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={target === 'cancelado' ? 'Motivo de la cancelación (opcional)' : 'Nota para el historial (opcional)'}
                placeholderTextColor={colors.muted}
                multiline
                maxLength={500}
                style={[styles.noteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.sheetActions}>
                <Pressable disabled={saving} onPress={() => setTarget(null)} style={[styles.sheetBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.actionText, { color: colors.text }]}>Volver</Text>
                </Pressable>
                <Pressable
                  disabled={saving}
                  onPress={confirmChange}
                  style={[styles.sheetBtn, { backgroundColor: target === 'cancelado' ? palette.danger : palette.primary, opacity: saving ? 0.7 : 1 }]}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionPrimaryText}>Confirmar</Text>}
                </Pressable>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Card({
  title,
  icon,
  colors,
  action,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: Colors;
  action?: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHead}>
        <Ionicons name={icon} size={16} color={palette.primary} />
        <Text style={[styles.cardTitle, styles.flex, { color: colors.text }]}>{title}</Text>
        {action && (
          <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button" style={styles.cardAction}>
            <Ionicons name={action.icon} size={15} color={palette.primary} />
            <Text style={[styles.cardActionText, { color: palette.primary }]}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function Field({ label, value, colors, mono, tone }: { label: string; value: string; colors: Colors; mono?: boolean; tone?: string }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.small, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: tone ?? colors.text }, mono && styles.mono]} selectable>{value}</Text>
    </View>
  );
}

function Block({ label, value, colors }: { label: string; value: string; colors: Colors }) {
  return (
    <View style={[styles.block, { backgroundColor: colors.background }]}>
      <Text style={[styles.small, styles.bold, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.blockText, { color: colors.text }]} selectable>{value}</Text>
    </View>
  );
}

function Money({ label, value, colors, tone }: { label: string; value: string; colors: Colors; tone?: string }) {
  return (
    <View style={styles.flex}>
      <Text style={[styles.small, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.moneyValue, { color: tone ?? colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 6 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  ticket: { fontSize: 12, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardActionText: { fontSize: 13, fontWeight: '800' },
  partsList: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 4 },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 13, fontWeight: '800' },
  small: { fontSize: 12, lineHeight: 17 },
  timeline: { flexDirection: 'row', marginTop: 4 },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepTrack: { width: '100%', height: 18, alignItems: 'center', justifyContent: 'center' },
  stepLine: { position: 'absolute', right: '50%', left: '-50%', height: 2, top: 8 },
  stepDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 10, fontWeight: '600' },
  section: { gap: 8 },
  outcome: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  outcomeText: { fontSize: 13, fontWeight: '800' },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  actions: { gap: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  actionPrimary: { borderWidth: 0 },
  actionText: { fontSize: 14, fontWeight: '700' },
  actionPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  field: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  fieldValue: { fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  block: { borderRadius: 10, padding: 10, gap: 4 },
  blockText: { fontSize: 14, lineHeight: 20 },
  customer: { fontSize: 16, fontWeight: '800' },
  contactRow: { flexDirection: 'row', gap: 10 },
  contact: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 11 },
  moneyRow: { flexDirection: 'row', gap: 10 },
  moneyValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  photos: { gap: 8 },
  photo: { width: 110, height: 110, borderRadius: 12 },
  h2: { fontSize: 18, fontWeight: '800' },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 12 },
  noteInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 80, fontSize: 15, textAlignVertical: 'top' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: 10 },
  sheetBtn: { flex: 1, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
