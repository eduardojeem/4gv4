import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { apiFetch } from '@/lib/api';
import { palette, usePalette } from '@/lib/palette';
import { ROLE_LABELS, usePanel } from '@/lib/panel';
import {
  avatarPath,
  avatarStoragePath,
  isProfileDirty,
  nameError,
  passwordChangeError,
  passwordStrength,
  PASSWORD_MIN,
  phoneError,
  profilePatch,
  type ProfileDraft,
} from '@/lib/profile-model';
import { useSession } from '@/lib/session';
import { supabase, verifyCurrentPassword } from '@/lib/supabase';

type RemoteProfile = {
  fullName?: string;
  email?: string;
  emailVerified?: boolean;
  avatarUrl?: string;
  phone?: string;
  jobTitle?: string;
};

const EMPTY: ProfileDraft = { fullName: '', phone: '', jobTitle: '' };
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const STRENGTH_COLORS = ['#CBD5E1', '#DC2626', '#D97706', '#16A34A', '#15803D'];

const initialOf = (value?: string | null) => (value || '?').trim().charAt(0).toUpperCase();

export default function MobileUserProfileScreen() {
  const colors = usePalette();
  const { session, signOut, biometric, setBiometricEnabled } = useSession();
  const { data: panelData, reload } = usePanel();
  const userId = session?.user?.id ?? null;
  const org = panelData?.organization;

  const [saved, setSaved] = useState<ProfileDraft>(EMPTY);
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY);
  const [email, setEmail] = useState(panelData?.user.email || session?.user?.email || '');
  const [emailVerified, setEmailVerified] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(panelData?.user.avatarUrl || null);

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [savingBiometric, setSavingBiometric] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Contraseña
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Sin el perfil cargado no se deja guardar: el formulario vacío pisaría el teléfono y el cargo.
  useEffect(() => {
    let active = true;
    apiFetch<{ profile: RemoteProfile }>('/api/dashboard/profile')
      .then(({ profile }) => {
        if (!active) return;
        const next = { fullName: profile.fullName ?? '', phone: profile.phone ?? '', jobTitle: profile.jobTitle ?? '' };
        setSaved(next);
        setDraft(next);
        if (profile.email) setEmail(profile.email);
        setEmailVerified(profile.emailVerified !== false);
        setAvatarUrl(profile.avatarUrl || null);
        setLoadState('ready');
      })
      .catch(() => active && setLoadState('error'));
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const flash = useCallback((tone: 'success' | 'error', text: string) => {
    setNotice({ tone, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (tone === 'success') noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  }, []);

  const dirty = isProfileDirty(draft, saved);
  const errors = { fullName: nameError(draft.fullName), phone: phoneError(draft.phone) };
  const valid = !errors.fullName && !errors.phone;

  const confirmLeave = (leave: () => void) => {
    if (!dirty) return leave();
    Alert.alert('Cambios sin guardar', '¿Salir sin guardar los cambios de tu perfil?', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Salir sin guardar', style: 'destructive', onPress: leave },
    ]);
  };

  const handleBack = () => confirmLeave(() => (router.canGoBack() ? router.back() : router.replace('/panel' as never)));

  const saveProfile = async () => {
    setTouched(true);
    if (!dirty || !valid || saving || loadState !== 'ready') return;
    setSaving(true);
    try {
      await apiFetch('/api/dashboard/profile', { method: 'PATCH', body: JSON.stringify(profilePatch(draft, saved)) });
      const next = { fullName: draft.fullName.trim(), phone: draft.phone.trim(), jobTitle: draft.jobTitle.trim() };
      setSaved(next);
      setDraft(next);
      setTouched(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      flash('success', 'Tus datos se guardaron.');
      reload();
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      flash('error', err instanceof Error ? err.message : 'No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const saveAvatarUrl = async (url: string) => {
    await apiFetch('/api/dashboard/profile', { method: 'PATCH', body: JSON.stringify({ avatarUrl: url }) });
  };

  const uploadAvatar = async (source: 'camera' | 'library') => {
    if (!userId || avatarBusy) return;
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso necesario', source === 'camera'
        ? 'Habilitá la cámara en los ajustes del teléfono para sacarte una foto.'
        : 'Habilitá el acceso a tus fotos en los ajustes del teléfono para elegir una.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset?.uri) return;
    if (asset.fileSize && asset.fileSize > AVATAR_MAX_BYTES) {
      Alert.alert('Imagen muy pesada', 'Elegí una foto de hasta 5 MB.');
      return;
    }

    setAvatarBusy(true);
    const previous = avatarUrl;
    try {
      const mimeType = asset.mimeType === 'image/png' || asset.mimeType === 'image/webp' ? asset.mimeType : 'image/jpeg';
      const path = avatarPath(userId, mimeType);
      const body = await fetch(asset.uri).then((r) => r.arrayBuffer());
      const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType: mimeType, cacheControl: '3600', upsert: false });
      if (error) throw new Error(error.message);
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      await saveAvatarUrl(url);
      setAvatarUrl(url);
      // La foto anterior ya no se usa: se borra para no acumular archivos.
      const oldPath = avatarStoragePath(previous, userId);
      if (oldPath) void supabase.storage.from('avatars').remove([oldPath]).catch(() => undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      flash('success', 'Foto actualizada.');
      reload();
    } catch (err) {
      flash('error', err instanceof Error ? `No se pudo subir la foto: ${err.message}` : 'No se pudo subir la foto. Probá con otra imagen.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (!userId || !avatarUrl || avatarBusy) return;
    setAvatarBusy(true);
    try {
      await saveAvatarUrl('');
      const oldPath = avatarStoragePath(avatarUrl, userId);
      if (oldPath) void supabase.storage.from('avatars').remove([oldPath]).catch(() => undefined);
      setAvatarUrl(null);
      flash('success', 'Quitaste tu foto.');
      reload();
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'No se pudo quitar la foto.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const openAvatarMenu = () => {
    if (avatarBusy) return;
    Alert.alert('Foto de perfil', undefined, [
      { text: 'Sacar una foto', onPress: () => void uploadAvatar('camera') },
      { text: 'Elegir de la galería', onPress: () => void uploadAvatar('library') },
      ...(avatarUrl ? [{ text: 'Quitar la foto', style: 'destructive' as const, onPress: () => void removeAvatar() }] : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  const strength = passwordStrength(newPassword);

  const changePassword = async () => {
    const problem = passwordChangeError({ current: currentPassword, next: newPassword, confirm: confirmPassword });
    if (problem) {
      setPasswordError(problem);
      return;
    }
    if (!email) {
      setPasswordError('Tu cuenta no tiene correo para verificar la contraseña.');
      return;
    }
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      // Que alguien con el teléfono desbloqueado no pueda cambiarla sin saber la actual.
      if (!(await verifyCurrentPassword(email, currentPassword))) {
        setPasswordError('La contraseña actual no es correcta.');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOpen(false);
      flash('success', 'Cambiaste tu contraseña.');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const toggleBiometric = async (next: boolean) => {
    if (savingBiometric) return;
    setSavingBiometric(true);
    const ok = await setBiometricEnabled(next);
    setSavingBiometric(false);
    if (!ok) flash('error', `No se pudo ${next ? 'activar' : 'desactivar'} ${biometric.label}. Revisá que esté configurado en el teléfono.`);
  };

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Querés salir de tu cuenta en este teléfono?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/');
        },
      },
    ]);
  };

  const displayName = draft.fullName.trim() || saved.fullName || panelData?.user.name || 'Tu nombre';
  const version = Constants.expoConfig?.version;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>Mi perfil</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Cabecera con foto */}
          <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.heroBand, { backgroundColor: palette.primary }]} />
            <Pressable
              onPress={openAvatarMenu}
              disabled={avatarBusy || !userId}
              accessibilityRole="button"
              accessibilityLabel="Cambiar foto de perfil"
              style={[styles.avatarRing, { borderColor: colors.card }]}>
              <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.fill} contentFit="cover" transition={150} />
                ) : (
                  <Text style={styles.avatarInitial}>{initialOf(displayName || email)}</Text>
                )}
                {avatarBusy && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                )}
              </View>
              <View style={[styles.cameraBadge, { backgroundColor: palette.primary, borderColor: colors.card }]}>
                <Ionicons name="camera" size={15} color="#FFFFFF" />
              </View>
            </Pressable>
            <Text numberOfLines={1} style={[styles.heroName, { color: colors.text }]}>{displayName}</Text>
            <View style={styles.emailRow}>
              <Text numberOfLines={1} style={[styles.heroEmail, { color: colors.muted }]}>{email || 'Sin correo'}</Text>
              {email ? (
                <Ionicons
                  name={emailVerified ? 'checkmark-circle' : 'alert-circle'}
                  size={15}
                  color={emailVerified ? palette.success : '#D97706'}
                  accessibilityLabel={emailVerified ? 'Correo verificado' : 'Correo sin verificar'}
                />
              ) : null}
            </View>
            <View style={styles.badgeRow}>
              {org?.role && <Badge icon="shield-checkmark" text={ROLE_LABELS[org.role] ?? org.role} color={palette.primary} background="rgba(37,99,235,0.12)" />}
              {org?.name && <Badge icon="business-outline" text={org.name} color={colors.muted} background="rgba(100,116,139,0.12)" />}
            </View>
          </View>

          {notice && (
            <View accessibilityRole="alert" style={[styles.notice, notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError]}>
              <Ionicons name={notice.tone === 'success' ? 'checkmark-circle' : 'alert-circle'} size={18} color={notice.tone === 'success' ? palette.success : palette.danger} />
              <Text style={[styles.noticeText, { color: notice.tone === 'success' ? '#166534' : palette.danger }]}>{notice.text}</Text>
            </View>
          )}

          {/* Datos personales */}
          <Section title="Datos personales" subtitle="Tu equipo los ve en ventas, turnos y reparaciones" colors={colors}>
            {loadState === 'loading' ? (
              <View style={styles.skeletonWrap}>
                {[0, 1, 2].map((key) => <View key={key} style={[styles.skeleton, { backgroundColor: colors.border }]} />)}
              </View>
            ) : loadState === 'error' ? (
              <View style={styles.loadError}>
                <Text style={[styles.body, { color: colors.muted }]}>No pudimos cargar tus datos. Revisá la conexión.</Text>
                <Pressable onPress={() => { setLoadState('loading'); setAttempt((n) => n + 1); }} style={[styles.outlineBtn, { borderColor: colors.border }]} accessibilityRole="button">
                  <Text style={[styles.outlineText, { color: colors.text }]}>Reintentar</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Field
                  label="Nombre y apellido"
                  value={draft.fullName}
                  onChangeText={(fullName) => setDraft((d) => ({ ...d, fullName }))}
                  error={touched || draft.fullName !== saved.fullName ? errors.fullName : null}
                  placeholder="Tu nombre completo"
                  autoCapitalize="words"
                  autoComplete="name"
                  maxLength={120}
                  colors={colors}
                />
                <Field
                  label="Teléfono"
                  optional
                  value={draft.phone}
                  onChangeText={(phone) => setDraft((d) => ({ ...d, phone }))}
                  error={errors.phone}
                  placeholder="0981 123 456"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={40}
                  colors={colors}
                />
                <Field
                  label="Cargo o puesto"
                  optional
                  value={draft.jobTitle}
                  onChangeText={(jobTitle) => setDraft((d) => ({ ...d, jobTitle }))}
                  placeholder="Ej.: Encargado, Técnico, Cajero"
                  maxLength={100}
                  colors={colors}
                />
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.muted }]}>Correo</Text>
                  <View style={[styles.readOnly, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ionicons name="mail-outline" size={18} color={colors.muted} />
                    <Text numberOfLines={1} style={[styles.readOnlyText, { color: colors.muted }]}>{email}</Text>
                    <Ionicons name="lock-closed-outline" size={15} color={colors.muted} />
                  </View>
                  <Text style={[styles.help, { color: colors.muted }]}>Es tu usuario para entrar. Para cambiarlo escribinos desde «Enviar comentarios».</Text>
                </View>

                {dirty && (
                  <View style={styles.saveRow}>
                    <Pressable
                      onPress={() => { setDraft(saved); setTouched(false); }}
                      disabled={saving}
                      accessibilityRole="button"
                      style={[styles.outlineBtn, styles.saveRowBtn, { borderColor: colors.border }]}>
                      <Text style={[styles.outlineText, { color: colors.text }]}>Descartar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void saveProfile()}
                      disabled={saving || !valid}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: saving || !valid, busy: saving }}
                      style={[styles.primaryBtn, styles.saveRowBtn, { opacity: saving || !valid ? 0.6 : 1 }]}>
                      {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.primaryText}>Guardar cambios</Text>}
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </Section>

          {/* Seguridad */}
          <Section title="Seguridad" subtitle="Cómo entrás a tu cuenta en este teléfono" colors={colors}>
            {biometric.available && (
              <Row
                icon="finger-print-outline"
                title={`Entrar con ${biometric.label}`}
                subtitle={biometric.enabled ? 'Activado en este teléfono' : 'Desbloqueá la app sin escribir la contraseña'}
                colors={colors}
                trailing={(
                  <Switch
                    value={biometric.enabled}
                    disabled={savingBiometric}
                    onValueChange={(next) => void toggleBiometric(next)}
                    trackColor={{ true: palette.primary, false: colors.border }}
                    accessibilityLabel={`Entrar con ${biometric.label}`}
                  />
                )}
              />
            )}
            <Row
              icon="shield-checkmark-outline"
              title="Verificación en dos pasos"
              subtitle="Pedir un código de tu app autenticadora al entrar"
              colors={colors}
              onPress={() => confirmLeave(() => router.push('/panel/two-factor' as never))}
              trailing={<Ionicons name="chevron-forward" size={18} color={colors.muted} />}
            />
            <Row
              icon="key-outline"
              title="Cambiar contraseña"
              subtitle="Te pedimos la actual para confirmar que sos vos"
              colors={colors}
              onPress={() => { setPasswordOpen((v) => !v); setPasswordError(null); }}
              trailing={<Ionicons name={passwordOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />}
            />
            {passwordOpen && (
              <View style={[styles.passwordBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Field label="Contraseña actual" value={currentPassword} onChangeText={(v) => { setCurrentPassword(v); setPasswordError(null); }} secureTextEntry={!showPasswords} autoComplete="current-password" textContentType="password" autoCapitalize="none" colors={colors} />
                <Field label="Nueva contraseña" value={newPassword} onChangeText={(v) => { setNewPassword(v); setPasswordError(null); }} secureTextEntry={!showPasswords} autoComplete="new-password" textContentType="newPassword" autoCapitalize="none" placeholder={`Mínimo ${PASSWORD_MIN} caracteres`} colors={colors} />
                {newPassword ? (
                  <View style={styles.strength} accessibilityLabel={`Seguridad de la contraseña: ${strength.label}`}>
                    <View style={styles.strengthBars}>
                      {[1, 2, 3, 4].map((step) => (
                        <View key={step} style={[styles.strengthBar, { backgroundColor: strength.score >= step ? STRENGTH_COLORS[strength.score] : colors.border }]} />
                      ))}
                    </View>
                    <Text style={[styles.help, { color: STRENGTH_COLORS[strength.score] }]}>{strength.label}</Text>
                  </View>
                ) : null}
                <Field label="Repetí la nueva contraseña" value={confirmPassword} onChangeText={(v) => { setConfirmPassword(v); setPasswordError(null); }} secureTextEntry={!showPasswords} autoComplete="new-password" textContentType="newPassword" autoCapitalize="none" colors={colors} />
                <Pressable onPress={() => setShowPasswords((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: showPasswords }} style={styles.showRow} hitSlop={6}>
                  <Ionicons name={showPasswords ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
                  <Text style={[styles.help, { color: colors.muted }]}>{showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Text>
                </Pressable>
                {passwordError && <Text accessibilityRole="alert" style={[styles.help, { color: palette.danger }]}>{passwordError}</Text>}
                <Pressable
                  onPress={() => void changePassword()}
                  disabled={passwordBusy}
                  accessibilityRole="button"
                  style={[styles.primaryBtn, { opacity: passwordBusy ? 0.6 : 1 }]}>
                  {passwordBusy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.primaryText}>Cambiar contraseña</Text>}
                </Pressable>
              </View>
            )}
          </Section>

          {/* Preferencias y ayuda */}
          <Section title="Preferencias y ayuda" colors={colors}>
            <Row icon="notifications-outline" title="Notificaciones" subtitle="Qué avisos te llegan al celular" colors={colors} onPress={() => confirmLeave(() => router.push('/panel/settings/notifications' as never))} trailing={<Ionicons name="chevron-forward" size={18} color={colors.muted} />} />
            <Row icon="chatbox-ellipses-outline" title="Enviar comentarios" subtitle="Un error, una idea o algo que funciona bien" colors={colors} onPress={() => confirmLeave(() => router.push('/feedback' as never))} trailing={<Ionicons name="chevron-forward" size={18} color={colors.muted} />} />
          </Section>

          {/* Salir */}
          <Pressable onPress={handleSignOut} accessibilityRole="button" style={[styles.logoutBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="log-out-outline" size={20} color={palette.danger} />
            <Text style={[styles.logoutText, { color: palette.danger }]}>Cerrar sesión</Text>
          </Pressable>

          {/* Zona de peligro, separada y discreta */}
          <View style={[styles.dangerZone, { borderColor: 'rgba(220,38,38,0.3)' }]}>
            <Text style={[styles.dangerTitle, { color: colors.text }]}>Eliminar la cuenta</Text>
            <Text style={[styles.help, { color: colors.muted }]}>Bloquea tu acceso y a los 30 días borra tus datos personales.</Text>
            <Pressable onPress={() => confirmLeave(() => router.push('/delete-account' as never))} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.dangerLink, { color: palette.danger }]}>Eliminar mi cuenta…</Text>
            </Pressable>
          </View>

          <Text style={[styles.footer, { color: colors.muted }]}>Mi TiendaPy{version ? ` · versión ${version}` : ''}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type Colors = ReturnType<typeof usePalette>;

function Section({ title, subtitle, colors, children }: { title: string; subtitle?: string; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.help, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Field({ label, optional, error, colors, ...input }: TextInputProps & { label: string; optional?: boolean; error?: string | null; colors: Colors }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: colors.text }]}>
        {label}
        {optional ? <Text style={{ color: colors.muted, fontWeight: '500' }}> (opcional)</Text> : null}
      </Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, { backgroundColor: colors.background, borderColor: error ? palette.danger : colors.border, color: colors.text }]}
      />
      {error ? <Text style={[styles.help, { color: palette.danger }]}>{error}</Text> : null}
    </View>
  );
}

function Row({ icon, title, subtitle, trailing, onPress, colors }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; trailing?: React.ReactNode; onPress?: () => void; colors: Colors }) {
  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
        <Ionicons name={icon} size={20} color={palette.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.help, { color: colors.muted }]}>{subtitle}</Text>
      </View>
      {trailing}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>{content}</Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

function Badge({ icon, text, color, background }: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string; background: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text numberOfLines={1} style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '800' },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  hero: { borderWidth: 1, borderRadius: 22, alignItems: 'center', paddingBottom: 18, overflow: 'hidden', gap: 4 },
  heroBand: { position: 'absolute', top: 0, left: 0, right: 0, height: 64, opacity: 0.9 },
  avatarRing: { marginTop: 22, borderWidth: 4, borderRadius: 52, marginBottom: 6 },
  avatar: { width: 96, height: 96, borderRadius: 48, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 36, fontWeight: '800', color: '#FFFFFF' },
  avatarOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  cameraBadge: { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 20, fontWeight: '800', paddingHorizontal: 16 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16 },
  heroEmail: { fontSize: 13, flexShrink: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 6, paddingHorizontal: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, maxWidth: 220 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  noticeSuccess: { backgroundColor: 'rgba(22,163,74,0.1)', borderColor: 'rgba(22,163,74,0.3)' },
  noticeError: { backgroundColor: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)' },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '700' },
  section: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 14 },
  sectionHead: { gap: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20 },
  help: { fontSize: 12, lineHeight: 17 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  readOnly: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  readOnlyText: { flex: 1, fontSize: 15 },
  skeletonWrap: { gap: 12 },
  skeleton: { height: 48, borderRadius: 12, opacity: 0.5 },
  loadError: { gap: 8, alignItems: 'flex-start' },
  saveRow: { flexDirection: 'row', gap: 10 },
  saveRowBtn: { flex: 1 },
  primaryBtn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, paddingHorizontal: 16 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  outlineBtn: { minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  outlineText: { fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  passwordBox: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  strength: { gap: 4, marginTop: -4 },
  strengthBars: { flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  showRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  logoutBtn: { minHeight: 52, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { fontSize: 15, fontWeight: '800' },
  dangerZone: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 14, gap: 4 },
  dangerTitle: { fontSize: 14, fontWeight: '800' },
  dangerLink: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  footer: { fontSize: 12, textAlign: 'center' },
});
