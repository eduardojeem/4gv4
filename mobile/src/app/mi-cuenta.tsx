import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch } from '@/lib/api';
import { pickAndUploadAvatar, removeAvatar } from '@/lib/avatar';
import { palette, usePalette } from '@/lib/palette';
import { nameError, NAME_MAX, phoneError } from '@/lib/profile-model';
import { useSession } from '@/lib/session';

/**
 * «Editar perfil» del comprador: nombre, teléfono y foto. «Mi perfil» del panel
 * vive dentro del área de personal y pide un comercio; esta pantalla sirve a
 * cualquier cuenta y usa las mismas reglas (profile-model), la misma foto
 * (lib/avatar) y la misma API (/api/dashboard/profile).
 */
export default function BuyerProfileEditScreen() {
  const colors = usePalette();
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState({ fullName: '', phone: '' });
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ profile: { fullName?: string; phone?: string; avatarUrl?: string } }>('/api/dashboard/profile')
      .then(({ profile }) => {
        if (!active) return;
        const next = { fullName: profile.fullName ?? '', phone: profile.phone ?? '' };
        setSaved(next);
        setFullName(next.fullName);
        setPhone(next.phone);
        setAvatarUrl(profile.avatarUrl || null);
        setLoadState('ready');
      })
      .catch(() => active && setLoadState('error'));
    return () => { active = false; };
  }, [attempt]);

  const errors = { fullName: nameError(fullName), phone: phoneError(phone) };
  const dirty = fullName.trim() !== saved.fullName.trim() || phone.trim() !== saved.phone.trim();
  const canSave = loadState === 'ready' && dirty && !errors.fullName && !errors.phone && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setNotice(null);
    try {
      const patch: Record<string, string> = {};
      if (fullName.trim() !== saved.fullName.trim()) patch.fullName = fullName.trim();
      if (phone.trim() !== saved.phone.trim()) patch.phone = phone.trim();
      await apiFetch('/api/dashboard/profile', { method: 'PATCH', body: JSON.stringify(patch) });
      setSaved({ fullName: fullName.trim(), phone: phone.trim() });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setNotice({ tone: 'success', text: 'Tus datos se guardaron.' });
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const changePhoto = (source: 'camera' | 'library') => async () => {
    if (!userId || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const url = await pickAndUploadAvatar(source, userId, avatarUrl);
      if (url) {
        setAvatarUrl(url);
        setNotice({ tone: 'success', text: 'Foto actualizada.' });
      }
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? `No se pudo subir la foto: ${err.message}` : 'No se pudo subir la foto.' });
    } finally {
      setAvatarBusy(false);
    }
  };

  const openPhotoMenu = () => {
    if (avatarBusy || !userId) return;
    Alert.alert('Foto de perfil', undefined, [
      { text: 'Sacar una foto', onPress: () => void changePhoto('camera')() },
      { text: 'Elegir de la galería', onPress: () => void changePhoto('library')() },
      ...(avatarUrl ? [{
        text: 'Quitar la foto',
        style: 'destructive' as const,
        onPress: () => {
          setAvatarBusy(true);
          removeAvatar(userId, avatarUrl)
            .then(() => { setAvatarUrl(null); setNotice({ tone: 'success', text: 'Quitaste tu foto.' }); })
            .catch((err) => setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'No se pudo quitar la foto.' }))
            .finally(() => setAvatarBusy(false));
        },
      }] : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  const goBack = () => {
    const leave = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/', params: { tab: 'perfil' } } as never));
    if (!dirty) return leave();
    Alert.alert('Cambios sin guardar', '¿Salir sin guardar tus datos?', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Salir sin guardar', style: 'destructive', onPress: leave },
    ]);
  };

  const initial = (fullName || session?.user.email || '?').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Pressable onPress={goBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Volver" style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Editar perfil</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {loadState === 'loading' && <ActivityIndicator color={palette.primary} style={styles.loading} />}
          {loadState === 'error' && (
            <View style={styles.center}>
              <Text style={[styles.body, { color: colors.text }]}>No pudimos cargar tus datos. Revisá la conexión.</Text>
              <Pressable onPress={() => { setLoadState('loading'); setAttempt((n) => n + 1); }} style={[styles.outline, { borderColor: colors.border }]} accessibilityRole="button">
                <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
              </Pressable>
            </View>
          )}

          {loadState === 'ready' && (
            <>
              <Pressable onPress={openPhotoMenu} disabled={avatarBusy} accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil" style={styles.avatarWrap}>
                <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
                  {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.fill} contentFit="cover" /> : <Text style={styles.avatarInitial}>{initial}</Text>}
                  {avatarBusy && <View style={styles.overlay}><ActivityIndicator color="#FFFFFF" /></View>}
                </View>
                <Text style={[styles.link, { color: palette.primary }]}>Cambiar foto</Text>
              </Pressable>

              {notice && (
                <Text accessibilityRole="alert" style={[styles.notice, { color: notice.tone === 'success' ? palette.success : palette.danger }]}>{notice.text}</Text>
              )}

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Nombre y apellido</Text>
                <TextInput
                  value={fullName}
                  onChangeText={(value) => { setFullName(value); setNotice(null); }}
                  placeholder="Cómo querés que te vean las tiendas"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="words"
                  autoComplete="name"
                  maxLength={NAME_MAX}
                  accessibilityLabel="Nombre y apellido"
                  style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: errors.fullName && fullName !== saved.fullName ? palette.danger : colors.border }]}
                />
                {errors.fullName && fullName !== saved.fullName ? <Text style={[styles.help, { color: palette.danger }]}>{errors.fullName}</Text> : null}
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Teléfono <Text style={{ color: colors.muted, fontWeight: '500' }}>(opcional)</Text></Text>
                <TextInput
                  value={phone}
                  onChangeText={(value) => { setPhone(value); setNotice(null); }}
                  placeholder="0981 123 456"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={40}
                  accessibilityLabel="Teléfono"
                  style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: errors.phone ? palette.danger : colors.border }]}
                />
                {errors.phone ? <Text style={[styles.help, { color: palette.danger }]}>{errors.phone}</Text> : null}
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.muted }]}>Correo</Text>
                <Text style={[styles.body, { color: colors.muted, textAlign: 'left' }]}>{session?.user.email}</Text>
              </View>

              <Pressable onPress={() => void save()} disabled={!canSave} accessibilityRole="button" accessibilityState={{ disabled: !canSave, busy: saving }} style={[styles.primary, { opacity: canSave ? 1 : 0.5 }]}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Guardar cambios</Text>}
              </Pressable>

              <Pressable onPress={() => router.push('/delete-account' as never)} accessibilityRole="button" style={styles.deleteLink} hitSlop={8}>
                <Text style={[styles.small, { color: palette.danger }]}>Eliminar mi cuenta…</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  content: { padding: 20, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  loading: { marginTop: 40 },
  center: { alignItems: 'center', gap: 10, padding: 24 },
  avatarWrap: { alignItems: 'center', gap: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 36, fontWeight: '800' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 14, fontWeight: '700' },
  notice: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  help: { fontSize: 12 },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  bold: { fontSize: 14, fontWeight: '800' },
  small: { fontSize: 13, fontWeight: '600' },
  outline: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  primary: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  deleteLink: { alignItems: 'center', paddingVertical: 4 },
});
