import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { CASH_STATUS, cashActions, fetchOverview, performCashAction, type CashAction, type OpenSession } from '@/lib/admin';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

type Colors = ReturnType<typeof usePalette>;

const since = (iso: string, now: number) => {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ${minutes % 60} min` : `${Math.floor(hours / 24)} días`;
};

/** Monitor de cajas, como /admin/cash-monitor: todas las cajas abiertas y las acciones del administrador. */
export default function CashMonitorScreen() {
  const colors = usePalette();
  const [sessions, setSessions] = useState<OpenSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<OpenSession | null>(null);
  // La hora de la última carga: los «hace X min» se cuentan contra ella.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    fetchOverview()
      .then((data) => {
        if (!active) return;
        setSessions(data.cash);
        setNow(Date.now());
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudieron cargar las cajas.'))
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const total = (sessions ?? []).reduce((sum, session) => sum + session.salesTotal, 0);

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Text style={[styles.topTitle, { color: colors.text }]}>Monitor de cajas</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}>
        {sessions === null ? (
          error ? (
            <View style={styles.empty}>
              <Text style={[styles.bold, { color: colors.text }]}>{error}</Text>
              <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
                <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <ActivityIndicator style={styles.loading} color={palette.primary} />
          )
        ) : (
          <>
            <Text style={[styles.muted, { color: colors.muted }]}>
              {sessions.length} {sessions.length === 1 ? 'caja abierta' : 'cajas abiertas'} · vendieron {formatGs(total)} en sus turnos
            </Text>
            {sessions.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="lock-closed-outline" size={34} color={colors.muted} />
                <Text style={[styles.bold, { color: colors.text }]}>No hay cajas abiertas</Text>
              </View>
            )}
            {sessions.map((session) => {
              const status = CASH_STATUS[session.status];
              const idle = session.lastActivityAt ? (now - new Date(session.lastActivityAt).getTime()) / 3600000 : 0;
              return (
                <Pressable key={session.id} onPress={() => setSelected(session)} style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: session.status === 'open' ? colors.border : `${status.color}66`, opacity: pressed ? 0.85 : 1 }]}>
                  <View style={styles.cardTop}>
                    <View style={[styles.icon, { backgroundColor: `${status.color}1A` }]}>
                      <Ionicons name={session.status === 'open' ? 'lock-open-outline' : session.status === 'suspended' ? 'pause-circle-outline' : 'ban-outline'} size={20} color={status.color} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.name, { color: colors.text }]}>{session.registerName}</Text>
                      <Text style={[styles.small, { color: colors.muted }]}>
                        {session.branchName} · abierta hace {since(session.openedAt, now)}
                      </Text>
                    </View>
                    <View style={[styles.tag, { backgroundColor: `${status.color}1A` }]}>
                      <Text style={[styles.tagText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <View style={styles.stats}>
                    <Stat label="Inicial" value={formatGs(session.openingBalance)} colors={colors} />
                    <Stat label="Ventas" value={`${session.salesCount}`} colors={colors} />
                    <Stat label="Vendido" value={formatGs(session.salesTotal)} colors={colors} />
                  </View>
                  {idle >= 3 && session.status === 'open' && (
                    <Text style={[styles.small, { color: '#D97706', fontWeight: '700' }]}>Sin movimiento hace {since(session.lastActivityAt!, now)}.</Text>
                  )}
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      {selected && (
        <ActionSheet
          session={selected}
          colors={colors}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </View>
  );
}

function ActionSheet({ session, colors, onClose, onDone }: { session: OpenSession; colors: Colors; onClose: () => void; onDone: () => void }) {
  const [action, setAction] = useState<CashAction | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = cashActions(session.status);
  const chosen = options.find((option) => option.action === action);
  const needsReason = action === 'block' || action === 'remote_close' || action === 'suspend';

  const run = () => {
    if (!action) return;
    if (needsReason && reason.trim().length < 3) return setError('Escribí el motivo: queda en la auditoría.');
    setSaving(true);
    setError(null);
    performCashAction(session.id, action, reason)
      .then(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onDone();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo ejecutar la acción.'))
      .finally(() => setSaving(false));
  };

  return (
    <BottomSheet
      visible
      title={session.registerName}
      subtitle={`${session.branchName} · ${CASH_STATUS[session.status].label.toLowerCase()}`}
      onClose={() => !saving && onClose()}
      footer={
        action ? (
          <Pressable onPress={run} disabled={saving} style={[styles.primary, { backgroundColor: chosen?.destructive ? palette.danger : palette.primary, opacity: saving ? 0.6 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{chosen?.label}</Text>}
          </Pressable>
        ) : null
      }>
      {options.map((option) => {
        const selected = action === option.action;
        return (
          <Pressable key={option.action} onPress={() => setAction(option.action)} style={[styles.option, { borderColor: selected ? (option.destructive ? palette.danger : palette.primary) : colors.border, backgroundColor: colors.background }]}>
            <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? (option.destructive ? palette.danger : palette.primary) : colors.muted} />
            <View style={styles.flex}>
              <Text style={[styles.bold, { color: option.destructive ? palette.danger : colors.text }]}>{option.label}</Text>
              <Text style={[styles.tiny, { color: colors.muted }]}>{option.hint}</Text>
            </View>
          </Pressable>
        );
      })}
      {action && (
        <TextInput value={reason} onChangeText={setReason} maxLength={500} multiline placeholder={needsReason ? 'Motivo (obligatorio)' : 'Motivo (opcional)'} placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </BottomSheet>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: Colors }) {
  return (
    <View style={styles.flex}>
      <Text style={[styles.tiny, { color: colors.muted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.bold, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { fontSize: 13 },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  bold: { fontSize: 14, fontWeight: '800' },
  loading: { paddingVertical: 30 },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingTop: 14, paddingBottom: 2 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '800' },
  tag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  stats: { flexDirection: 'row', gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  primary: { borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
