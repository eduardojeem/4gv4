import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { PanelAccessState } from '@/components/panel-access-state';
import { Field, Notice, SaveBar, Section, StateView, ToggleRow, WebsiteScreen, useUnsavedChangesGuard, websiteStyles } from '@/components/website/website-ui';
import {
  agendaErrorMessage,
  createAppointment,
  fetchAgenda,
  fetchAppointment,
  formatMoney,
  lookupCustomers,
  notifyAgendaChanged,
  updateAppointment,
  type CustomerMatch,
} from '@/lib/agenda';
import {
  FREE_SERVICE,
  addDays,
  appointmentPayload,
  dayLabel,
  emptyForm,
  formFromAppointment,
  formIssues,
  isValidTime,
  minutesOf,
  professionalDoesService,
  serviceTerms,
  termsChanged,
  timeOf,
  timeOptions,
  todayIn,
  withinHours,
  type AgendaData,
  type Appointment,
  type AppointmentForm,
} from '@/lib/agenda-model';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';

type Loaded = { data: AgendaData; original: Appointment | null; initial: AppointmentForm };

export default function AppointmentFormScreen() {
  const params = useLocalSearchParams<{ id?: string; date?: string; time?: string; professional?: string }>();
  const { data: panel, findItem, loading: panelLoading } = usePanel();
  const organizationId = panel?.organization.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const allowed = Boolean(findItem('agenda'));

  useEffect(() => {
    if (!organizationId || !allowed) return;
    let alive = true;
    (async () => {
      const original = params.id ? await fetchAppointment(params.id) : null;
      // Siempre la configuración fresca: tarifas, profesionales y modo de reserva pueden haber cambiado.
      const day = original ? original.starts_at.slice(0, 10) : params.date ?? todayIn();
      const data = await fetchAgenda(day, 1);
      const initial = original
        ? formFromAppointment(original, data.timeZone)
        : emptyForm(data, params.date ?? todayIn(data.timeZone), params.time ?? '', params.professional ?? null);
      if (alive) setLoaded({ data, original, initial });
    })().catch((cause) => {
      if (alive) setError(agendaErrorMessage(cause, 'No pudimos abrir el turno.'));
    });
    return () => {
      alive = false;
    };
  }, [organizationId, allowed, params.id, params.date, params.time, params.professional, attempt]);

  if (panelLoading || !allowed) return <PanelAccessState />;
  const title = params.id ? 'Editar turno' : 'Nuevo turno';
  if (!loaded) {
    return (
      <WebsiteScreen title={title}>
        {error ? <StateView icon="alert-circle-outline" title="No pudimos abrir el turno" text={error} action="Reintentar" onAction={() => { setError(null); setAttempt((value) => value + 1); }} /> : <StateView loading title="Cargando…" />}
      </WebsiteScreen>
    );
  }
  return <AppointmentEditor key={loaded.original?.id ?? 'new'} title={title} {...loaded} />;
}

function AppointmentEditor({ title, data, original, initial }: Loaded & { title: string }) {
  const colors = usePalette();
  const [form, setForm] = useState<AppointmentForm>(initial);
  const [saving, setSaving] = useState(false);
  const [customerQuery, setCustomerQuery] = useState<{ term: string; results: CustomerMatch[] }>({ term: '', results: [] });
  const searchId = useRef(0);
  const mode = original ? 'edit' : 'create';
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const issues = formIssues(form, data, original);
  const set = (next: Partial<AppointmentForm>) => setForm((current) => ({ ...current, ...next }));

  const activeProfessionals = data.professionals.filter((item) => item.is_active);
  const selectedService = data.services.find((item) => item.product_id === form.service) ?? null;
  const eligible = selectedService ? activeProfessionals.filter((item) => professionalDoesService(item, selectedService.product_id)) : activeProfessionals;
  const professional = activeProfessionals.find((item) => item.id === form.professionalId) ?? null;
  const hours = professional?.opening_hours ?? data.settings.opening_hours;
  const duration = Number(form.duration) || data.settings.slot_minutes;
  const today = todayIn(data.timeZone);
  const dates = useMemo(() => {
    const list = Array.from({ length: 14 }, (_, index) => addDays(today, index));
    return list.includes(form.date) ? list : [form.date, ...list];
  }, [today, form.date]);
  const times = timeOptions(form.date, hours, data.settings.slot_minutes, duration);
  const outside = isValidTime(form.time) && !withinHours(form.date, form.time, duration, hours);
  const end = isValidTime(form.time) ? timeOf((minutesOf(form.time) + duration) % (24 * 60)) : null;
  const advanced = data.capabilities.professionalBooking;

  // Precio y duración según servicio y profesional (tarifa propia si tiene).
  const applyTerms = (serviceId: string | null, professionalId: string | null) => {
    const service = data.services.find((item) => item.product_id === serviceId);
    if (!service) {
      set({ service: serviceId, professionalId, acceptNewTerms: false });
      return;
    }
    const terms = serviceTerms(service, professionalId, data.professionalRates, original);
    set({ service: serviceId, professionalId, serviceName: service.name, price: String(terms.price), duration: String(terms.durationMinutes), buffer: terms.bufferMinutes, acceptNewTerms: false });
  };

  const chooseService = (serviceId: string) => {
    if (serviceId === FREE_SERVICE) {
      set({ service: FREE_SERVICE, serviceName: form.service === FREE_SERVICE ? form.serviceName : '' });
      return;
    }
    // Si el profesional elegido no hace este servicio, se deja sin elegir.
    const keep = form.professionalId && activeProfessionals.some((item) => item.id === form.professionalId && professionalDoesService(item, serviceId));
    applyTerms(serviceId, keep ? form.professionalId : null);
  };

  // Clientes del comercio mientras se escribe el nombre (solo vale la última búsqueda).
  useEffect(() => {
    const term = form.customerName.trim();
    if (form.customerId || term.length < 2) return;
    const id = ++searchId.current;
    const timer = setTimeout(() => {
      lookupCustomers(term)
        .then((results) => {
          if (id === searchId.current) setCustomerQuery({ term, results });
        })
        .catch(() => {
          if (id === searchId.current) setCustomerQuery({ term, results: [] });
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [form.customerName, form.customerId]);
  const matches = !form.customerId && customerQuery.term === form.customerName.trim() ? customerQuery.results : [];

  const save = useCallback(async () => {
    if (issues.length) {
      Alert.alert('Revisá el turno', issues.join('\n'));
      return false;
    }
    setSaving(true);
    try {
      const payload = appointmentPayload(form, data, mode);
      if (original) await updateAppointment(original.id, payload);
      else await createAppointment(payload);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      notifyAgendaChanged();
      return true;
    } catch (cause) {
      Alert.alert('No pudimos guardar el turno', agendaErrorMessage(cause, 'Revisá la conexión y la agenda antes de reintentar.'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [issues, form, data, mode, original]);

  const [done, setDone] = useState(false);
  useUnsavedChangesGuard(dirty && !saving && !done, save);
  const submit = async () => {
    if (await save()) {
      setDone(true);
      // Abierto desde un enlace no hay pantalla anterior: se vuelve a la agenda.
      setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/panel/agenda' as never)), 0);
    }
  };

  return (
    <WebsiteScreen title={title} subtitle={original ? original.customer_name : 'Agenda'} footer={<SaveBar dirty={dirty} saving={saving} onSave={() => void submit()} label={original ? 'Guardar cambios' : 'Agendar turno'} />}>
      <Section title="Cliente" icon="person-outline">
        <Field label="Nombre" value={form.customerName} onChangeText={(value) => set({ customerName: value, customerId: null })} placeholder="Buscá un cliente o escribí el nombre" maxLength={160} />
        {form.customerId ? <Text style={[styles.hint, { color: palette.success }]}>Cliente guardado del comercio</Text> : null}
        {matches.map((match) => (
          <Pressable key={match.id} onPress={() => set({ customerId: match.id, customerName: match.name, customerPhone: match.whatsapp || match.phone || form.customerPhone })} accessibilityRole="button"
            style={[styles.match, { borderColor: colors.border }]}>
            <Text style={[styles.matchName, { color: colors.text }]}>{match.name}</Text>
            <Text style={[styles.hint, { color: colors.muted }]}>{match.whatsapp || match.phone || 'Sin teléfono'}</Text>
          </Pressable>
        ))}
        <Field label="WhatsApp o teléfono" value={form.customerPhone} onChangeText={(value) => set({ customerPhone: value })} placeholder="0981 123 456" keyboardType="phone-pad" maxLength={40} help="Para confirmarle y recordarle el turno por WhatsApp." />
      </Section>

      <Section title="Servicio" icon="cut-outline">
        {data.services.length === 0 ? <Text style={[styles.hint, { color: colors.muted }]}>Todavía no cargaste servicios: escribí el nombre o cargalos desde la web.</Text> : null}
        <View style={styles.chips}>
          {data.services.map((service) => (
            <Chip key={service.product_id} label={service.name} hint={`${service.duration_minutes} min · ${formatMoney(service.price, data.currency)}`} selected={form.service === service.product_id} onPress={() => chooseService(service.product_id)} />
          ))}
          <Chip label="Otro" selected={form.service === FREE_SERVICE} onPress={() => chooseService(FREE_SERVICE)} />
        </View>
        {form.service === FREE_SERVICE || (!form.service && data.services.length === 0) ? (
          <Field label="Nombre del servicio" value={form.serviceName} onChangeText={(value) => set({ serviceName: value, service: FREE_SERVICE })} placeholder="Corte y barba" maxLength={200} />
        ) : null}
      </Section>

      {activeProfessionals.length ? (
        <Section title="Quién atiende" icon="people-outline">
          <View style={styles.chips}>
            {eligible.map((item) => (
              <Chip key={item.id} label={item.name} color={item.color} selected={form.professionalId === item.id} onPress={() => (form.service && form.service !== FREE_SERVICE ? applyTerms(form.service, item.id) : set({ professionalId: item.id }))} />
            ))}
          </View>
          {selectedService && eligible.length === 0 ? <Notice tone="warning" text="Ningún profesional activo hace este servicio. Revisalo desde la web." /> : null}
        </Section>
      ) : null}

      <Section title="Día y hora" icon="calendar-outline">
        <View style={styles.chips}>
          {dates.map((date) => <Chip key={date} label={dayLabel(date, today)} selected={form.date === date} onPress={() => set({ date })} />)}
        </View>
        {times.length ? (
          <View style={styles.chips}>
            {times.map((time) => <Chip key={time} label={time} selected={form.time === time} onPress={() => set({ time })} />)}
          </View>
        ) : (
          <Text style={[styles.hint, { color: colors.muted }]}>{professional ? `${professional.name} no atiende ese día.` : 'Ese día está cerrado según tu horario de atención.'}</Text>
        )}
        <Field label="Otra hora" value={form.time} onChangeText={(value) => set({ time: value.replace(/[^\d:]/g, '').slice(0, 5) })} placeholder="09:30" keyboardType="numbers-and-punctuation" maxLength={5}
          help={end ? `Termina a las ${end}.` : 'Formato de 24 horas, por ejemplo 14:30.'} />
        {outside ? <Notice tone="warning" text="Ese horario queda fuera del horario de atención." /> : null}
        {outside && advanced && data.canConfigure ? <ToggleRow label="Agendar igual fuera de horario" value={form.allowOutsideHours} onValueChange={(value) => set({ allowOutsideHours: value })} /> : null}
      </Section>

      <Section title="Detalle" icon="document-text-outline">
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label="Duración (min)" value={form.duration} onChangeText={(value) => set({ duration: value.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={3} />
          </View>
          <View style={styles.flex}>
            <Field label="Precio" value={form.price} onChangeText={(value) => set({ price: value.replace(/[^\d.,]/g, '') })} keyboardType="decimal-pad" maxLength={14} />
          </View>
        </View>
        <Field label="Notas" value={form.notes} onChangeText={(value) => set({ notes: value })} placeholder="Algo para tener en cuenta" multiline maxLength={1000} />
        {mode === 'create' ? <ToggleRow label="Dejar por confirmar" hint="Queda pendiente hasta que se lo confirmes al cliente." value={form.pending} onValueChange={(value) => set({ pending: value })} /> : null}
        {advanced && termsChanged(form, original) ? (
          <ToggleRow label="Acepto la nueva tarifa y duración" hint={`${formatMoney(Number(form.price) || 0, data.currency)} · ${form.duration} min con el servicio y profesional elegidos.`} value={form.acceptNewTerms} onValueChange={(value) => set({ acceptNewTerms: value })} />
        ) : null}
      </Section>
      {saving ? <ActivityIndicator color={palette.primary} /> : null}
    </WebsiteScreen>
  );
}

function Chip({ label, hint, selected, onPress, color }: { label: string; hint?: string; selected: boolean; onPress: () => void; color?: string }) {
  const colors = usePalette();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={hint ? `${label}, ${hint}` : label}
      style={[websiteStyles.chip, styles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? `${palette.primary}12` : 'transparent' }]}>
      {color ? <View style={[styles.swatch, { backgroundColor: color }]} /> : null}
      <View>
        <Text style={[websiteStyles.chipText, { color: selected ? palette.primary : colors.text }]}>{label}</Text>
        {hint ? <Text style={[styles.chipHint, { color: colors.muted }]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipHint: { fontSize: 11 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  hint: { fontSize: 12 },
  match: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  matchName: { fontSize: 14, fontWeight: '700' },
});
