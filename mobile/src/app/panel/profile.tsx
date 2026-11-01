import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { apiFetch } from '@/lib/api';
import { palette, usePalette } from '@/lib/palette';
import { ROLE_LABELS, usePanel } from '@/lib/panel';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const initialOf = (value?: string | null) => (value || '?').trim().charAt(0).toUpperCase();

type DashboardProfileData = {
  fullName?: string;
  email?: string;
  avatarUrl?: string;
  phone?: string;
  jobTitle?: string;
  role?: string;
};

export default function MobileUserProfileScreen() {
  const colors = usePalette();
  const { session, signOut, biometric, setBiometricEnabled } = useSession();
  const { data: panelData, reload } = usePanel();

  const user = panelData?.user;
  const org = panelData?.organization;

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || session?.user?.email || '');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingBiometric, setSavingBiometric] = useState(false);

  // Password Change State
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Carga inicial del perfil completo desde el backend
  useEffect(() => {
    let active = true;

    apiFetch<{ profile: DashboardProfileData }>('/api/dashboard/profile')
      .then((res) => {
        if (!active || !res?.profile) return;
        const p = res.profile;
        if (p.fullName) setName(p.fullName);
        if (p.email) setEmail(p.email);
        if (p.phone) setPhone(p.phone);
        if (p.jobTitle) setJobTitle(p.jobTitle);
        if (p.avatarUrl) setAvatarUrl(p.avatarUrl);
      })
      .catch((err) => {
        console.warn('[profile] No se pudo cargar perfil detallado:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Guardar datos personales
  const handleSaveProfile = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      Alert.alert('Nombre requerido', 'El nombre debe tener al menos 2 caracteres.');
      return;
    }

    setSaving(true);
    try {
      await apiFetch<{ profile: unknown }>('/api/dashboard/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: trimmedName,
          phone: phone.trim() || null,
          jobTitle: jobTitle.trim() || null,
          ...(avatarUrl ? { avatarUrl } : {}),
        }),
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      reload();
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.');
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  // Selección y subida de foto de perfil
  const handlePickAvatar = async () => {
    if (uploadingAvatar) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Habilitá el acceso a la galería para cambiar tu foto de perfil.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('Imagen muy grande', 'Por favor seleccioná una imagen de menos de 5 MB.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const uri = asset.uri;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const fileName = `${session?.user?.id ?? 'user'}_${Date.now()}.${extension}`;
      const filePath = `${fileName}`;

      const fileBuffer = await fetch(uri).then((r) => r.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, fileBuffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: true,
      });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const publicUrl = supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl;
      setAvatarUrl(publicUrl);

      // Guardar inmediatamente la nueva URL en el perfil
      await apiFetch<{ profile: unknown }>('/api/dashboard/profile', {
        method: 'PATCH',
        body: JSON.stringify({ avatarUrl: publicUrl }),
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      reload();
    } catch (err) {
      console.warn('[profile] Error al subir avatar:', err);
      Alert.alert('No se pudo subir la foto', err instanceof Error ? err.message : 'Probá con otra imagen o revisá tu conexión.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Actualizar contraseña
  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Contraseña corta', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Contraseñas no coinciden', 'La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
      Alert.alert('Contraseña actualizada', 'Tu contraseña se cambió con éxito.');
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      Alert.alert('Error al cambiar contraseña', err instanceof Error ? err.message : 'No se pudo actualizar.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Conmutar biometría
  const toggleBiometric = async (next: boolean) => {
    if (savingBiometric) return;
    setSavingBiometric(true);
    const ok = await setBiometricEnabled(next);
    setSavingBiometric(false);
    if (!ok) {
      Alert.alert(
        `No se pudo ${next ? 'activar' : 'desactivar'} ${biometric.label}`,
        `Revisá que ${biometric.label} esté configurado en el teléfono y probá de nuevo.`
      );
    }
  };

  // Cerrar sesión
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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/panel' as never);
    }
  };

  const userInitial = initialOf(name || email);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Barra superior de navegación */}
      <View style={[styles.topBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver al panel">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>Mi perfil</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>Cargando datos de perfil...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Tarjeta Hero / Avatar */}
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.avatarWrap}>
                <View style={[styles.avatarCircle, { backgroundColor: palette.primary }]}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImg} contentFit="cover" />
                  ) : (
                    <Text style={styles.avatarInitial}>{userInitial}</Text>
                  )}
                  {uploadingAvatar && (
                    <View style={styles.avatarUploadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={handlePickAvatar}
                  disabled={uploadingAvatar}
                  accessibilityRole="button"
                  accessibilityLabel="Cambiar foto de perfil"
                  style={[styles.cameraBadge, { backgroundColor: palette.primary, borderColor: colors.card }]}>
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </Pressable>
              </View>

              <View style={styles.heroDetails}>
                <Text numberOfLines={1} style={[styles.heroName, { color: colors.text }]}>
                  {name || 'Usuario'}
                </Text>
                <Text numberOfLines={1} style={[styles.heroEmail, { color: colors.muted }]}>
                  {email || 'Sin correo'}
                </Text>

                <View style={styles.badgeRow}>
                  {org?.role && (
                    <View style={[styles.badgePill, { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
                      <Ionicons name="shield-checkmark" size={12} color={palette.primary} />
                      <Text style={[styles.badgeText, { color: palette.primary }]}>
                        {ROLE_LABELS[org.role] ?? org.role}
                      </Text>
                    </View>
                  )}
                  {org?.name && (
                    <View style={[styles.badgePill, { backgroundColor: 'rgba(100,116,139,0.12)' }]}>
                      <Ionicons name="business-outline" size={12} color={colors.muted} />
                      <Text numberOfLines={1} style={[styles.badgeText, { color: colors.muted }]}>
                        {org.name}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Sección: Datos personales */}
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Datos personales</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
                Información visible en el equipo y documentos de ventas
              </Text>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Nombre y apellido</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Tu nombre completo"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Teléfono</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="09xx xxx xxx"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Cargo o puesto</Text>
                <TextInput
                  value={jobTitle}
                  onChangeText={setJobTitle}
                  placeholder="Ej: Gerente comercial, Técnico, etc."
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.muted }]}>Correo electrónico</Text>
                <View style={[styles.inputReadOnly, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="mail-outline" size={18} color={colors.muted} style={styles.inputPrefixIcon} />
                  <Text numberOfLines={1} style={[styles.inputReadOnlyText, { color: colors.muted }]}>
                    {email}
                  </Text>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.muted} />
                </View>
                <Text style={[styles.inputHelpText, { color: colors.muted }]}>
                  El email está asociado a tu inicio de sesión y no puede modificarse desde la app.
                </Text>
              </View>

              {/* Botón Guardar Cambios */}
              <Pressable
                onPress={handleSaveProfile}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Guardar cambios de perfil"
                style={[styles.saveBtn, { backgroundColor: palette.primary, opacity: saving ? 0.7 : 1 }]}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Guardar datos personales</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Sección: Seguridad y acceso */}
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Seguridad y acceso</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
                Protección del dispositivo y credenciales de ingreso
              </Text>

              {/* Biometría (Face ID / Huella) */}
              {biometric.available && (
                <View style={[styles.biometricRow, { borderColor: colors.border }]}>
                  <View style={[styles.biometricIconWrap, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
                    <Ionicons name="finger-print-outline" size={22} color={palette.primary} />
                  </View>
                  <View style={styles.biometricTextWrap}>
                    <Text style={[styles.biometricTitle, { color: colors.text }]}>
                      Entrar con {biometric.label}
                    </Text>
                    <Text style={[styles.biometricSubtitle, { color: colors.muted }]}>
                      {biometric.enabled ? 'Activado en este dispositivo' : 'Desbloqueo rápido sin contraseña'}
                    </Text>
                  </View>
                  <Switch
                    value={biometric.enabled}
                    disabled={savingBiometric}
                    onValueChange={(next) => void toggleBiometric(next)}
                    trackColor={{ true: palette.primary, false: colors.border }}
                  />
                </View>
              )}

              {/* Conmutador de cambio de contraseña */}
              <Pressable
                onPress={() => setShowPasswordSection((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Cambiar contraseña"
                style={[styles.passwordToggleRow, { borderColor: colors.border }]}>
                <View style={[styles.passwordIconWrap, { backgroundColor: 'rgba(100,116,139,0.1)' }]}>
                  <Ionicons name="key-outline" size={20} color={colors.text} />
                </View>
                <View style={styles.passwordToggleText}>
                  <Text style={[styles.passwordToggleTitle, { color: colors.text }]}>Cambiar contraseña</Text>
                  <Text style={[styles.passwordToggleSubtitle, { color: colors.muted }]}>
                    Actualizar tu clave de acceso
                  </Text>
                </View>
                <Ionicons
                  name={showPasswordSection ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.muted}
                />
              </Pressable>

              {showPasswordSection && (
                <View style={[styles.passwordForm, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Nueva contraseña</Text>
                    <View style={[styles.passwordInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="Mínimo 6 caracteres"
                        placeholderTextColor={colors.muted}
                        secureTextEntry={!showPasswordText}
                        style={[styles.passwordInput, { color: colors.text }]}
                      />
                      <Pressable
                        onPress={() => setShowPasswordText((v) => !v)}
                        hitSlop={10}
                        style={styles.eyeBtn}>
                        <Ionicons
                          name={showPasswordText ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={colors.muted}
                        />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Confirmar nueva contraseña</Text>
                    <View style={[styles.passwordInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Repetí la contraseña"
                        placeholderTextColor={colors.muted}
                        secureTextEntry={!showPasswordText}
                        style={[styles.passwordInput, { color: colors.text }]}
                      />
                    </View>
                  </View>

                  <Pressable
                    onPress={handleUpdatePassword}
                    disabled={updatingPassword || !newPassword}
                    accessibilityRole="button"
                    accessibilityLabel="Confirmar cambio de contraseña"
                    style={[
                      styles.updatePasswordBtn,
                      {
                        backgroundColor: palette.primary,
                        opacity: updatingPassword || !newPassword ? 0.6 : 1,
                      },
                    ]}>
                    {updatingPassword ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
                        <Text style={styles.updatePasswordBtnText}>Actualizar contraseña</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>

            {/* Botón de Cerrar Sesión */}
            <View style={styles.logoutWrapper}>
              <Pressable
                onPress={handleSignOut}
                accessibilityRole="button"
                accessibilityLabel="Cerrar sesión en este dispositivo"
                style={[styles.logoutBtn, { borderColor: palette.danger }]}>
                <Ionicons name="log-out-outline" size={20} color={palette.danger} />
                <Text style={[styles.logoutBtnText, { color: palette.danger }]}>Cerrar sesión</Text>
              </Pressable>
              <Text style={[styles.footerText, { color: colors.muted }]}>
                MiTiendaPy Móvil · Sesión protegida
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  topBarSpacer: {
    width: 36,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarUploadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDetails: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
  },
  heroEmail: {
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: -8,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  inputReadOnly: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputPrefixIcon: {
    marginLeft: -2,
  },
  inputReadOnlyText: {
    flex: 1,
    fontSize: 15,
  },
  inputHelpText: {
    fontSize: 12,
    lineHeight: 16,
  },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  biometricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  biometricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricTextWrap: {
    flex: 1,
    gap: 2,
  },
  biometricTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  biometricSubtitle: {
    fontSize: 12,
  },
  passwordToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  passwordIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordToggleText: {
    flex: 1,
    gap: 2,
  },
  passwordToggleTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  passwordToggleSubtitle: {
    fontSize: 12,
  },
  passwordForm: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginTop: -4,
  },
  passwordInputWrap: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
  },
  eyeBtn: {
    padding: 6,
  },
  updatePasswordBtn: {
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  updatePasswordBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutWrapper: {
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  logoutBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  footerText: {
    fontSize: 12,
  },
});
