import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { changeRole, changeStatus, fetchTeam, inviteUser, resendInvite, ROLE_LABEL, TEAM_ROLES, type TeamRole, type TeamUser } from '@/lib/admin';
import { palette, usePalette } from '@/lib/palette';
import { useSession } from '@/lib/session';

type Colors = ReturnType<typeof usePalette>;

const STATUS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activo', color: '#16A34A' },
  inactive: { label: 'Inactivo', color: '#64748B' },
  suspended: { label: 'Suspendido', color: '#DC2626' },
};
const lastSeen = (iso: string | null) => {
  if (!iso) return 'Nunca entró';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? 'Entró hoy' : days === 1 ? 'Entró ayer' : `Entró hace ${days} días`;
};

/** Usuarios del equipo, como /admin/users: invitar, cambiar el rol, suspender o reactivar. */
export default function TeamScreen() {
  const colors = usePalette();
  const { session } = useSession();
  const me = session?.user.id;
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<TeamUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<TeamUser | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    fetchTeam({ search, page: 1 })
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudo cargar el equipo.'))
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [search, attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Text style={[styles.topTitle, { color: colors.text }]}>Usuarios y roles</Text>
        <Pressable onPress={() => setInviting(true)} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Invitar usuario">
          <Ionicons name="person-add-outline" size={22} color={palette.primary} />
        </Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={17} color={colors.muted} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Nombre o email" placeholderTextColor={colors.muted} autoCorrect={false} autoCapitalize="none" style={[styles.searchInput, { color: colors.text }]} />
            </View>
            {!loading && <Text style={[styles.small, { color: colors.muted }]}>{total} personas en el equipo</Text>}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={palette.primary} />
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.bold, styles.centerText, { color: colors.text }]}>{error ?? 'No hay usuarios con esa búsqueda.'}</Text>
              {error && (
                <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
                  <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
                </Pressable>
              )}
            </View>
          )
        }
        renderItem={({ item }) => <UserRow user={item} isMe={item.id === me} colors={colors} onPress={() => setSelected(item)} />}
      />

      {selected && (
        <UserSheet
          user={selected}
          isMe={selected.id === me}
          colors={colors}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
      {inviting && (
        <InviteSheet
          colors={colors}
          onClose={() => setInviting(false)}
          onDone={() => {
            setInviting(false);
            reload();
          }}
        />
      )}
    </View>
  );
}

function Avatar({ user, size = 44 }: { user: TeamUser; size?: number }) {
  const initial = (user.full_name || user.email || '?').trim().charAt(0).toUpperCase();
  return user.avatar_url ? (
    <Image source={user.avatar_url} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
  ) : (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

function UserRow({ user, isMe, colors, onPress }: { user: TeamUser; isMe: boolean; colors: Colors; onPress: () => void }) {
  const status = STATUS[user.status] ?? STATUS.active;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : user.status === 'active' ? 1 : 0.6 }]}>
      <Avatar user={user} />
      <View style={styles.flex}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
          {user.full_name || user.email}
          {isMe ? ' (vos)' : ''}
        </Text>
        <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
          {ROLE_LABEL[user.role] ?? user.role} · {lastSeen(user.last_sign_in_at)}
        </Text>
      </View>
      <View style={[styles.tag, { backgroundColor: `${status.color}1A` }]}>
        <Text style={[styles.tagText, { color: status.color }]}>{status.label}</Text>
      </View>
    </Pressable>
  );
}

function UserSheet({ user, isMe, colors, onClose, onChanged }: { user: TeamUser; isMe: boolean; colors: Colors; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const protectedUser = user.role === 'owner' || user.role === 'super_admin';
  const active = user.status === 'active';

  const run = (key: string, task: () => Promise<void>, done = 'Listo') => {
    setBusy(key);
    task()
      .then(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (done) Alert.alert(done);
        onChanged();
      })
      .catch((err) => Alert.alert('No se pudo', err instanceof Error ? err.message : 'Intentá de nuevo.'))
      .finally(() => setBusy(null));
  };

  const setStatus = (status: 'active' | 'inactive' | 'suspended') =>
    Alert.alert(status === 'active' ? 'Reactivar usuario' : status === 'suspended' ? 'Suspender usuario' : 'Desactivar usuario', status === 'active' ? 'Va a poder entrar de nuevo.' : 'No va a poder entrar al sistema hasta que lo reactives.', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Confirmar', style: status === 'active' ? 'default' : 'destructive', onPress: () => run(status, () => changeStatus(user.id, status), '') },
    ]);

  return (
    <BottomSheet visible title={user.full_name || user.email || 'Usuario'} subtitle={[user.email, ROLE_LABEL[user.role] ?? user.role].filter(Boolean).join(' · ')} onClose={() => !busy && onClose()}>
      <View style={styles.sheetHead}>
        <Avatar user={user} size={56} />
        <View style={styles.flex}>
          <Text style={[styles.small, { color: colors.muted }]}>{lastSeen(user.last_sign_in_at)}</Text>
          {user.branches?.length ? <Text style={[styles.small, { color: colors.muted }]}>Sucursales: {user.branches.map((branch) => branch.name).join(', ')}</Text> : null}
          {user.phone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${user.phone!.replace(/[^\d+]/g, '')}`)}>
              <Text style={[styles.small, { color: palette.primary, fontWeight: '700' }]}>{user.phone}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {protectedUser ? (
        <Text style={[styles.small, { color: colors.muted }]}>Es el dueño de la cuenta: su rol y su acceso no se cambian desde acá.</Text>
      ) : (
        <>
          <Text style={[styles.label, { color: colors.text }]}>Rol</Text>
          {TEAM_ROLES.map((role) => {
            const selected = user.role === role.key;
            return (
              <Pressable
                key={role.key}
                disabled={selected || Boolean(busy) || isMe}
                onPress={() =>
                  Alert.alert('Cambiar rol', `¿Pasar a ${user.full_name || user.email} a ${role.label}?`, [
                    { text: 'Volver', style: 'cancel' },
                    { text: 'Cambiar', onPress: () => run(role.key, () => changeRole(user.id, role.key), '') },
                  ])
                }
                style={[styles.option, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.06)' : colors.background, opacity: isMe && !selected ? 0.5 : 1 }]}>
                {busy === role.key ? <ActivityIndicator color={palette.primary} /> : <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? palette.primary : colors.muted} />}
                <View style={styles.flex}>
                  <Text style={[styles.bold, { color: colors.text }]}>{role.label}</Text>
                  <Text style={[styles.tiny, { color: colors.muted }]}>{role.hint}</Text>
                </View>
              </Pressable>
            );
          })}
          {isMe && <Text style={[styles.tiny, { color: colors.muted }]}>No podés cambiar tu propio rol ni desactivarte.</Text>}

          {!isMe && (
            <View style={styles.actions}>
              {active ? (
                <>
                  <ActionBtn label="Suspender" icon="pause-circle-outline" color={palette.danger} busy={busy === 'suspended'} onPress={() => setStatus('suspended')} colors={colors} />
                  <ActionBtn label="Desactivar" icon="person-remove-outline" color={colors.muted} busy={busy === 'inactive'} onPress={() => setStatus('inactive')} colors={colors} />
                </>
              ) : (
                <ActionBtn label="Reactivar" icon="person-outline" color={palette.success} busy={busy === 'active'} onPress={() => setStatus('active')} colors={colors} />
              )}
              {!user.last_sign_in_at && (
                <ActionBtn label="Reenviar invitación" icon="mail-outline" color={palette.primary} busy={busy === 'invite'} onPress={() => run('invite', () => resendInvite(user.id), 'Invitación reenviada')} colors={colors} />
              )}
            </View>
          )}
        </>
      )}
    </BottomSheet>
  );
}

function InviteSheet({ colors, onClose, onDone }: { colors: Colors; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<TeamRole>('vendedor');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = !name.trim() ? 'Escribí el nombre.' : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ? 'Revisá el email.' : null;

  const invite = () => {
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    inviteUser({ name, email, role, phone })
      .then(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Invitación enviada', `${email.trim()} va a recibir un email para crear su contraseña.`);
        onDone();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo invitar.'))
      .finally(() => setSaving(false));
  };

  const input = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }];
  return (
    <BottomSheet
      visible
      title="Invitar al equipo"
      subtitle="Le llega un email para crear su contraseña. Cuenta para el límite de usuarios de tu plan."
      onClose={() => !saving && onClose()}
      footer={
        <Pressable onPress={invite} disabled={saving} style={[styles.primary, { opacity: saving || problem ? 0.6 : 1 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="send-outline" size={18} color="#fff" />}
          <Text style={styles.primaryText}>Enviar invitación</Text>
        </Pressable>
      }>
      <TextInput value={name} onChangeText={setName} placeholder="Nombre y apellido" placeholderTextColor={colors.muted} autoCapitalize="words" autoFocus style={input} />
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" style={input} />
      <TextInput value={phone} onChangeText={setPhone} placeholder="Teléfono (opcional)" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={input} />
      <Text style={[styles.label, { color: colors.text }]}>Rol</Text>
      {TEAM_ROLES.map((item) => (
        <Pressable key={item.key} onPress={() => setRole(item.key)} style={[styles.option, { borderColor: role === item.key ? palette.primary : colors.border, backgroundColor: role === item.key ? 'rgba(37,99,235,0.06)' : colors.background }]}>
          <Ionicons name={role === item.key ? 'radio-button-on' : 'radio-button-off'} size={18} color={role === item.key ? palette.primary : colors.muted} />
          <View style={styles.flex}>
            <Text style={[styles.bold, { color: colors.text }]}>{item.label}</Text>
            <Text style={[styles.tiny, { color: colors.muted }]}>{item.hint}</Text>
          </View>
        </Pressable>
      ))}
      {error && <Text style={styles.error}>{error}</Text>}
    </BottomSheet>
  );
}

function ActionBtn({ label, icon, color, busy, onPress, colors }: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; busy: boolean; onPress: () => void; colors: Colors }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={[styles.actionBtn, { borderColor: colors.border }]}>
      {busy ? <ActivityIndicator color={color} /> : <Ionicons name={icon} size={18} color={color} />}
      <Text style={[styles.small, { color, fontWeight: '800' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerText: { textAlign: 'center' },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  bold: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '800' },
  loading: { paddingVertical: 30 },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingTop: 14, paddingBottom: 2 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  header: { gap: 8, marginBottom: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  avatar: { backgroundColor: 'rgba(37,99,235,0.12)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.primary, fontSize: 18, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '800' },
  tag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 11 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.primary, borderRadius: 14, minHeight: 52 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
