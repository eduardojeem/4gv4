import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { PanelAccessState } from '@/components/panel-access-state';
import { openWeb } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import {
  agendaErrorMessage,
  appointmentAction,
  appointmentPublicUrl,
  fetchAgenda,
  formatMoney,
  onAgendaChanged,
} from '@/lib/agenda';
import {
  DEFAULT_TIMEZONE,
  STATUS_COLORS,
  STATUS_LABELS,
  activeCountByDay,
  addDays,
  appointmentCode,
  appointmentWhatsApp,
  appointmentsOn,
  canDo,
  dayLabel,
  dayOfMonth,
  durationOf,
  shortWeekday,
  todayIn,
  utcToZoned,
  weekStart,
  whatsappUrl,
  type AgendaData,
  type Appointment,
  type AppointmentAction,
} from '@/lib/agenda-model';

type Loaded = { key: string; data: AgendaData | null; error: string | null };

const turnos = (count: number) => `${count} ${count === 1 ? 'turno' : 'turnos'}`;

export default function AgendaScreen() {
  const colors = usePalette();
  const { data: panel, findItem, loading: panelLoading } = usePanel();
  const organizationId = panel?.organization.id ?? null;
  const [timeZone, setTimeZone] = useState(DEFAULT_TIMEZONE);
  const today = todayIn(timeZone);
  const [selected, setSelected] = useState(today);
  const week = weekStart(selected);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [professional, setProfessional] = useState<string | null>(null);
  const [open, setOpen] = useState<Appointment | null>(null);
  const allowed = Boolean(findItem('agenda'));

  // Lo cargado vale solo para este comercio y esta semana.
  const key = `${organizationId}|${week}|${attempt}`;
  const current = loaded?.key === key ? loaded : null;
  const data = current?.data ?? (loaded?.key.startsWith(`${organizationId}|`) ? loaded.data : null);

  useEffect(() => {
    if (!organizationId || !allowed) return;
    let alive = true;
    fetchAgenda(week, 7)
      .then((next) => {
        if (!alive) return;
        setTimeZone(next.timeZone);
        setLoaded({ key, data: next, error: null });
      })
      .catch((cause) => {
        if (alive) setLoaded((previous) => ({ key, data: previous?.key.startsWith(`${organizationId}|`) ? previous.data : null, error: agendaErrorMessage(cause, 'No pudimos cargar la agenda.') }));
      })
      .finally(() => {
        if (alive) setRefreshing(false);
      });
    return () => {
      alive = false;
    };
  }, [organizationId, allowed, week, key]);

  // Un turno guardado desde el formulario se ve al volver.
  useEffect(() => onAgendaChanged(() => setAttempt((value) => value + 1)), []);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((value) => value + 1);
  }, []);

  const activeProfessionals = useMemo(() => (data?.professionals ?? []).filter((item) => item.is_active), [data]);
  const counts = useMemo(() => (data ? activeCountByDay(data.appointments, data.timeZone) : {}), [data]);
  const dayItems = useMemo(() => (data ? appointmentsOn(data.appointments, selected, data.timeZone, professional) : []), [data, selected, professional]);
  const professionalOf = (id: string | null) => data?.professionals.find((item) => item.id === id) ?? null;

  if (panelLoading || !allowed) return <PanelAccessState />;

  const newAppointment = () => router.push({ pathname: '/panel/agenda/form', params: { date: selected, ...(professional ? { professional } : {}) } } as never);
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));

  return (
    <View style={styles.flex}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <Text style={[styles.title, { color: colors.text }]}>Agenda</Text>
            <Text style={[styles.muted, { color: colors.muted }]}>{dayLabel(selected, today)}{data ? ` · ${turnos(dayItems.filter((item) => item.status !== 'cancelled').length)}` : ''}</Text>
          </View>
          {selected !== today ? (
            <Pressable onPress={() => setSelected(today)} accessibilityRole="button" style={[styles.todayBtn, { borderColor: colors.border }]}>
              <Text style={[styles.todayText, { color: colors.text }]}>Hoy</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={newAppointment} disabled={!data?.available} accessibilityRole="button" accessibilityLabel="Nuevo turno" style={({ pressed }) => [styles.newBtn, { opacity: pressed || !data?.available ? 0.7 : 1 }]}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.newBtnText}>Turno</Text>
          </Pressable>
        </View>

        <View style={styles.week}>
          <Pressable onPress={() => setSelected(addDays(selected, -7))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Semana anterior">
            <Ionicons name="chevron-back" size={22} color={colors.muted} />
          </Pressable>
          {days.map((date) => {
            const active = date === selected;
            return (
              <Pressable key={date} onPress={() => setSelected(date)} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${dayLabel(date, today)}, ${turnos(counts[date] ?? 0)}`}
                style={[styles.day, active && { backgroundColor: palette.primary }]}>
                <Text style={[styles.dayName, { color: active ? '#fff' : colors.muted }]}>{shortWeekday(date)}</Text>
                <Text style={[styles.dayNumber, { color: active ? '#fff' : date === today ? palette.primary : colors.text }]}>{dayOfMonth(date)}</Text>
                <View style={[styles.dot, { backgroundColor: counts[date] ? (active ? '#fff' : palette.primary) : 'transparent' }]} />
              </Pressable>
            );
          })}
          <Pressable onPress={() => setSelected(addDays(selected, 7))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Semana siguiente">
            <Ionicons name="chevron-forward" size={22} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      {activeProfessionals.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {[{ id: null, name: 'Todos', color: colors.muted }, ...activeProfessionals].map((item) => {
            const active = professional === item.id;
            return (
              <Pressable key={item.id ?? 'all'} onPress={() => setProfessional(item.id)} accessibilityRole="button" accessibilityState={{ selected: active }}
                style={[styles.filter, { borderColor: active ? palette.primary : colors.border, backgroundColor: active ? `${palette.primary}14` : colors.card }]}>
                {item.id ? <View style={[styles.swatch, { backgroundColor: item.color }]} /> : null}
                <Text style={[styles.filterText, { color: active ? palette.primary : colors.text }]}>{item.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}>
        {current?.error || (loaded?.error && !data) ? (
          <View style={[styles.notice, { borderColor: palette.danger }]}>
            <Text style={[styles.noticeText, { color: palette.danger }]}>{(current ?? loaded)?.error}</Text>
            <Pressable onPress={reload} accessibilityRole="button"><Text style={[styles.link, { color: palette.primary }]}>Reintentar</Text></Pressable>
          </View>
        ) : null}

        {!data ? (
          loaded?.error ? null : <ActivityIndicator style={styles.loading} color={palette.primary} />
        ) : !data.available ? (
          <Empty icon="calendar-outline" title="La agenda todavía no está activada" text="Activala y cargá tus servicios desde la web, en Agenda → Configuración." action="Abrir en la web" onAction={() => void openWeb('/dashboard/agenda/configuracion')} />
        ) : (
          <>
            {data.pendingCount > 0 ? (
              <View style={[styles.pending, { backgroundColor: `${STATUS_COLORS.pending}14`, borderColor: `${STATUS_COLORS.pending}55` }]}>
                <Ionicons name="time-outline" size={18} color={STATUS_COLORS.pending} />
                <Text style={[styles.pendingText, { color: colors.text }]}>{data.pendingCount} {data.pendingCount === 1 ? 'turno espera' : 'turnos esperan'} confirmación</Text>
              </View>
            ) : null}
            {!current && loaded ? <ActivityIndicator color={palette.primary} /> : null}
            {dayItems.length === 0 ? (
              <Empty icon="calendar-clear-outline" title={`Sin turnos ${selected === today ? 'hoy' : 'este día'}`} text="Agendá uno nuevo o elegí otro día." action="Agendar turno" onAction={newAppointment} />
            ) : (
              dayItems.map((item) => <AppointmentRow key={item.id} appointment={item} data={data} professional={professionalOf(item.professional_id)} onPress={() => setOpen(item)} />)
            )}
          </>
        )}
      </ScrollView>

      {data && open ? (
        <AppointmentSheet
          appointment={open}
          data={data}
          professionalName={professionalOf(open.professional_id)?.name ?? null}
          onClose={() => setOpen(null)}
          onChanged={(next) => {
            setOpen(next);
            setLoaded((value) => (value?.data ? { ...value, data: { ...value.data, appointments: value.data.appointments.map((item) => (item.id === next.id ? next : item)) } } : value));
            setAttempt((value) => value + 1);
          }}
        />
      ) : null}
    </View>
  );
}

function AppointmentRow({ appointment, data, professional, onPress }: { appointment: Appointment; data: AgendaData; professional: { name: string; color: string } | null; onPress: () => void }) {
  const colors = usePalette();
  const start = utcToZoned(appointment.starts_at, data.timeZone).time;
  const end = utcToZoned(appointment.ends_at, data.timeZone).time;
  const faded = appointment.status === 'cancelled' || appointment.status === 'no_show';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${start}, ${appointment.customer_name}, ${appointment.service_name}, ${STATUS_LABELS[appointment.status]}`}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : faded ? 0.6 : 1 }]}>
      <View style={[styles.stripe, { backgroundColor: professional?.color ?? STATUS_COLORS[appointment.status] }]} />
      <View style={styles.time}>
        <Text style={[styles.timeStart, { color: colors.text }]}>{start}</Text>
        <Text style={[styles.timeEnd, { color: colors.muted }]}>{end}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={[styles.customer, { color: colors.text }, faded && styles.strike]}>{appointment.customer_name}</Text>
        <Text numberOfLines={1} style={[styles.service, { color: colors.muted }]}>
          {appointment.service_name}{professional ? ` · ${professional.name}` : ''}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.status, { backgroundColor: `${STATUS_COLORS[appointment.status]}18` }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[appointment.status] }]}>{STATUS_LABELS[appointment.status]}</Text>
          </View>
          {appointment.source === 'online' ? <Ionicons name="globe-outline" size={14} color={colors.muted} accessibilityLabel="Reservado online" /> : null}
          {appointment.sale_id ? <Ionicons name="checkmark-done" size={15} color={palette.success} accessibilityLabel="Cobrado" /> : null}
          <Text style={[styles.price, { color: colors.text }]}>{formatMoney(appointment.price, data.currency)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function AppointmentSheet({ appointment, data, professionalName, onClose, onChanged }: {
  appointment: Appointment; data: AgendaData; professionalName: string | null; onClose: () => void; onChanged: (next: Appointment) => void;
}) {
  const colors = usePalette();
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const local = utcToZoned(appointment.starts_at, data.timeZone);
  const end = utcToZoned(appointment.ends_at, data.timeZone).time;
  const phone = appointment.customer_phone;

  const run = async (action: AppointmentAction, extra: { reason?: string } = {}) => {
    setBusy(action);
    try {
      const next = await appointmentAction(appointment.id, action, extra);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCancelling(false);
      onChanged(next);
      return next;
    } catch (cause) {
      Alert.alert('No pudimos actualizar el turno', agendaErrorMessage(cause, 'Actualizá la agenda e intentá nuevamente.'));
      return null;
    } finally {
      setBusy(null);
    }
  };

  // Abre WhatsApp con el mismo mensaje que la web y deja registrado lo que corresponde.
  const whatsapp = async (kind: 'confirm' | 'reminder') => {
    const message = appointmentWhatsApp(kind, {
      storeName: data.storeName, customerName: appointment.customer_name, serviceName: appointment.service_name,
      startsAt: appointment.starts_at, timeZone: data.timeZone, professionalName, url: appointmentPublicUrl(appointment.public_token),
    });
    const url = whatsappUrl(phone, message);
    if (!url) {
      Alert.alert('Falta el teléfono', 'Este turno no tiene un número de WhatsApp. Editalo para agregarlo.');
      return;
    }
    await Linking.openURL(url);
    if (kind === 'confirm' && appointment.status === 'pending') await run('confirm');
    if (kind === 'reminder') await run('reminder_sent');
  };

  const confirmThen = (title: string, text: string, label: string, action: AppointmentAction) =>
    Alert.alert(title, text, [{ text: 'Volver', style: 'cancel' }, { text: label, style: 'destructive', onPress: () => void run(action) }]);

  const footer = cancelling ? (
    <View style={styles.actions}>
      <ActionButton label="Volver" onPress={() => setCancelling(false)} />
      <ActionButton label="Cancelar turno" tone="danger" busy={busy === 'cancel'} onPress={() => void run('cancel', reason.trim() ? { reason: reason.trim() } : {})} />
    </View>
  ) : null;

  return (
    <BottomSheet visible title={appointment.customer_name} subtitle={`${appointmentCode(appointment.number)} · ${STATUS_LABELS[appointment.status]}`} onClose={onClose} footer={footer}>
      <View style={styles.sheet}>
        <Info icon="calendar-outline" text={`${dayLabel(local.date, todayIn(data.timeZone))} · ${local.time} a ${end} (${durationOf(appointment)} min)`} />
        <Info icon="cut-outline" text={`${appointment.service_name}${professionalName ? ` · con ${professionalName}` : ''}`} />
        <Info icon="cash-outline" text={`${formatMoney(appointment.price, data.currency)}${appointment.sale_id ? ' · cobrado' : ''}`} />
        {phone ? <Info icon="call-outline" text={phone} /> : null}
        {appointment.notes ? <Info icon="document-text-outline" text={appointment.notes} /> : null}
        {appointment.source === 'online' ? <Info icon="globe-outline" text="Reservado por el cliente desde la tienda online" /> : null}
        {appointment.reminder_sent_at ? <Info icon="notifications-outline" text="Recordatorio enviado" /> : null}
        {appointment.cancel_reason ? <Info icon="close-circle-outline" text={`Motivo: ${appointment.cancel_reason}`} /> : null}

        {cancelling ? (
          <View style={styles.reason}>
            <Text style={[styles.reasonLabel, { color: colors.text }]}>Motivo (opcional)</Text>
            <TextInput value={reason} onChangeText={setReason} placeholder="El cliente avisó que no puede" placeholderTextColor={colors.muted} maxLength={300}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
          </View>
        ) : (
          <>
            {phone && canDo(appointment, 'confirm') ? <ActionButton label="Confirmar y avisar por WhatsApp" tone="whatsapp" icon="logo-whatsapp" busy={busy === 'confirm'} onPress={() => void whatsapp('confirm')} /> : null}
            {phone && canDo(appointment, 'reminder_sent') ? <ActionButton label="Enviar recordatorio por WhatsApp" tone="whatsapp" icon="logo-whatsapp" busy={busy === 'reminder_sent'} onPress={() => void whatsapp('reminder')} /> : null}
            <View style={styles.actions}>
              {canDo(appointment, 'confirm') ? <ActionButton label="Confirmar" icon="checkmark" busy={busy === 'confirm'} onPress={() => void run('confirm')} /> : null}
              {canDo(appointment, 'complete') ? <ActionButton label="Atendido" icon="checkmark-done" busy={busy === 'complete'} onPress={() => void run('complete')} /> : null}
              {canDo(appointment, 'no_show') ? <ActionButton label="No vino" icon="person-remove-outline" busy={busy === 'no_show'} onPress={() => confirmThen('¿Marcar que no vino?', 'El horario queda libre en la agenda.', 'No vino', 'no_show')} /> : null}
              {canDo(appointment, 'reopen') ? <ActionButton label="Reabrir" icon="refresh" busy={busy === 'reopen'} onPress={() => void run('reopen')} /> : null}
            </View>
            <View style={styles.actions}>
              {canDo(appointment, 'edit') ? <ActionButton label="Editar" icon="create-outline" onPress={() => { onClose(); router.push({ pathname: '/panel/agenda/form', params: { id: appointment.id } } as never); }} /> : null}
              {phone ? <ActionButton label="Llamar" icon="call-outline" onPress={() => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`)} /> : null}
              {!appointment.sale_id && appointment.status !== 'cancelled' && appointment.status !== 'no_show'
                ? <ActionButton label="Cobrar en la web" icon="cart-outline" onPress={() => void openWeb(`/dashboard/pos?appointmentId=${appointment.id}`)} />
                : null}
            </View>
            {canDo(appointment, 'cancel') ? <ActionButton label="Cancelar turno" tone="danger" icon="close-circle-outline" onPress={() => setCancelling(true)} /> : null}
            {appointment.sale_id ? <Text style={[styles.hint, { color: colors.muted }]}>El turno ya está cobrado: no se puede editar ni reabrir.</Text> : null}
          </>
        )}
      </View>
    </BottomSheet>
  );
}

function Info({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const colors = usePalette();
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={17} color={colors.muted} />
      <Text style={[styles.infoText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

function ActionButton({ label, icon, onPress, busy, tone }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; busy?: boolean; tone?: 'danger' | 'whatsapp' }) {
  const colors = usePalette();
  const filled = tone === 'whatsapp';
  const color = tone === 'danger' ? palette.danger : filled ? '#fff' : colors.text;
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button"
      style={({ pressed }) => [styles.action, { borderColor: tone === 'danger' ? palette.danger : filled ? '#25D366' : colors.border, backgroundColor: filled ? '#25D366' : 'transparent', opacity: pressed || busy ? 0.7 : 1 }]}>
      {busy ? <ActivityIndicator size="small" color={color} /> : icon ? <Ionicons name={icon} size={17} color={color} /> : null}
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function Empty({ icon, title, text, action, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; action: string; onAction: () => void }) {
  const colors = usePalette();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={colors.muted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>{text}</Text>
      <Pressable onPress={onAction} accessibilityRole="button" style={[styles.outline, { borderColor: colors.border }]}>
        <Text style={[styles.link, { color: palette.primary }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  muted: { fontSize: 13, textAlign: 'center' },
  todayBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  todayText: { fontSize: 14, fontWeight: '700' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  newBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  week: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 },
  day: { flex: 1, alignItems: 'center', borderRadius: 12, paddingVertical: 6, gap: 2, minHeight: 56 },
  dayName: { fontSize: 11, fontWeight: '700' },
  dayNumber: { fontSize: 17, fontWeight: '800' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  filters: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  filterText: { fontSize: 13, fontWeight: '600' },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  list: { padding: 16, paddingBottom: 32, gap: 10 },
  loading: { paddingVertical: 40 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  noticeText: { fontSize: 13, fontWeight: '600' },
  link: { fontSize: 14, fontWeight: '800' },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  pendingText: { flex: 1, fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 6 },
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  stripe: { width: 4 },
  time: { width: 62, paddingVertical: 12, alignItems: 'center' },
  timeStart: { fontSize: 16, fontWeight: '800' },
  timeEnd: { fontSize: 12 },
  cardBody: { flex: 1, paddingVertical: 12, paddingRight: 12, gap: 3 },
  customer: { fontSize: 15, fontWeight: '800' },
  strike: { textDecorationLine: 'line-through' },
  service: { fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '800' },
  price: { marginLeft: 'auto', fontSize: 13, fontWeight: '700' },
  sheet: { gap: 10 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { flex: 1, fontSize: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 44 },
  actionText: { fontSize: 14, fontWeight: '700' },
  reason: { gap: 6 },
  reasonLabel: { fontSize: 13, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  hint: { fontSize: 12, textAlign: 'center' },
});
