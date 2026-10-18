import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

import { clearLegacyBiometricCredentials } from '@/lib/legacy-biometric';
import { palette, usePalette } from '@/lib/palette';
import { useSession } from '@/lib/session';

const RESET_URL = 'https://www.mitiendapy.com/login';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SECURE_KEYS = {
  REMEMBER_EMAIL: 'mt_remember_email',
  SAVED_EMAIL: 'mt_saved_email',
} as const;

export default function SignInScreen() {
  const { signIn } = useSession();
  const colors = usePalette();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  // Opciones de conveniencia
  const [rememberEmail, setRememberEmail] = useState(true);
  // Inicialización: cargar datos recordados y verificar biometría
  useEffect(() => {
    async function initAuthPreferences() {
      try {
        await clearLegacyBiometricCredentials(SecureStore);
        const [savedEmail, rememberFlag] = await Promise.all([
          SecureStore.getItemAsync(SECURE_KEYS.SAVED_EMAIL),
          SecureStore.getItemAsync(SECURE_KEYS.REMEMBER_EMAIL),
        ]);

        if (rememberFlag !== 'false' && savedEmail) {
          setEmail(savedEmail);
          setRememberEmail(true);
        } else if (rememberFlag === 'false') {
          setRememberEmail(false);
        }

      } catch {
        // Fallback silencioso si falla el llavero local
      }
    }

    initAuthPreferences();
  }, []);

  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = emailValid && password.length > 0 && !busy;
  const emailProblem =
    emailTouched && email.trim() !== '' && !emailValid
      ? 'Email incompleto o inválido (ej. usuario@gmail.com).'
      : null;
  const hint = busy ? null : !email.trim() || !password ? 'Ingresá tu email y contraseña para continuar.' : null;

  // Inicio de sesión normal
  const submit = async () => {
    Keyboard.dismiss();
    setEmailTouched(true);
    if (!canSubmit) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setBusy(true);
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const message = await signIn(email, password);

    if (message) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
      setBusy(false);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        if (rememberEmail) {
          await SecureStore.setItemAsync(SECURE_KEYS.SAVED_EMAIL, email.trim());
          await SecureStore.setItemAsync(SECURE_KEYS.REMEMBER_EMAIL, 'true');
        } else {
          await SecureStore.deleteItemAsync(SECURE_KEYS.SAVED_EMAIL);
          await SecureStore.setItemAsync(SECURE_KEYS.REMEMBER_EMAIL, 'false');
        }

      } catch {
        // Almacenamiento no bloqueante
      }
    }
  };

  const clearEmail = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEmail('');
    setEmailTouched(false);
  };

  const togglePasswordVisibility = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPassword((prev) => !prev);
  };

  const toggleRememberEmail = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRememberEmail((prev) => !prev);
  };

  const inputBackground = isDark ? '#1E293B' : '#F8FAFC';
  const inputBorderDefault = isDark ? '#334155' : '#E2E8F0';

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />

        {/* Ambient Top Glow / Aura */}
        <View
          style={[
            styles.ambientGlow,
            {
              backgroundColor: isDark ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.08)',
            },
          ]}
        />

        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              
              {/* Header de Marca Moderno */}
              <View style={styles.brandContainer}>
                <View
                  style={[
                    styles.logoBadge,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    },
                  ]}>
                  <Image
                    source={require('@/assets/images/branding/brand-icon.png')}
                    style={styles.brandIconImage}
                    contentFit="contain"
                    accessibilityLabel="Logo oficial Mi tiendaPY.com"
                  />
                </View>
                <View style={styles.brandTitleRow}>
                  <Text style={[styles.brandName, { color: colors.text }]}>
                    Mi tiendaPY<Text style={{ color: palette.primary }}>.com</Text>
                  </Text>
                </View>
                <Text style={[styles.brandSub, { color: colors.muted }]}>
                  Punto de venta y control comercial
                </Text>
              </View>

              <Text style={[styles.brandSub, { color: colors.muted }]}>
                Por seguridad, ya no guardamos tu contraseña para el acceso biométrico. Ingresá con tu email y contraseña.
              </Text>

              {/* Tarjeta de Formulario Principal */}
              <View
                style={[
                  styles.formCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isDark ? '#1E293B' : '#E2E8F0',
                  },
                ]}>
                
                {/* Título de la tarjeta */}
                <View style={styles.formHeader}>
                  <Text style={[styles.formTitle, { color: colors.text }]}>Iniciar sesión</Text>
                  <Text style={[styles.formSubtitle, { color: colors.muted }]}>
                    Accedé a tus ventas, cobros y stock en tiempo real.
                  </Text>
                </View>

                {/* Campo Email */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Correo electrónico</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: inputBackground,
                        borderColor: emailProblem
                          ? palette.danger
                          : focused === 'email'
                          ? palette.primary
                          : inputBorderDefault,
                        borderWidth: focused === 'email' || emailProblem ? 1.5 : 1,
                      },
                    ]}>
                    <Ionicons
                      name="mail-outline"
                      size={19}
                      color={focused === 'email' ? palette.primary : colors.muted}
                      style={styles.fieldIcon}
                    />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocused('email')}
                      onBlur={() => {
                        setFocused(null);
                        setEmailTouched(true);
                      }}
                      accessibilityLabel="Correo electrónico"
                      accessibilityHint={emailProblem ?? undefined}
                      placeholder="nombre@mitienda.com"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="username"
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      editable={!busy}
                      style={[styles.textInput, { color: colors.text }]}
                    />
                    {email.length > 0 && !busy && (
                      <Pressable
                        onPress={clearEmail}
                        accessibilityRole="button"
                        accessibilityLabel="Borrar correo"
                        hitSlop={8}
                        style={styles.actionIcon}>
                        <Ionicons name="close-circle" size={18} color={colors.muted} />
                      </Pressable>
                    )}
                  </View>
                  {emailProblem && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={14} color={palette.danger} />
                      <Text style={styles.fieldErrorText}>{emailProblem}</Text>
                    </View>
                  )}
                </View>

                {/* Campo Contraseña */}
                <View style={styles.inputGroup}>
                  <View style={styles.passwordLabelRow}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Contraseña</Text>
                    <Pressable
                      onPress={() => Linking.openURL(RESET_URL)}
                      accessibilityRole="link"
                      hitSlop={8}>
                      <Text style={[styles.forgotLink, { color: palette.primary }]}>¿Olvidaste?</Text>
                    </Pressable>
                  </View>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: inputBackground,
                        borderColor: focused === 'password' ? palette.primary : inputBorderDefault,
                        borderWidth: focused === 'password' ? 1.5 : 1,
                      },
                    ]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={19}
                      color={focused === 'password' ? palette.primary : colors.muted}
                      style={styles.fieldIcon}
                    />
                    <TextInput
                      ref={passwordRef}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      accessibilityLabel="Contraseña"
                      placeholder="••••••••••••"
                      placeholderTextColor={colors.muted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="password"
                      textContentType="password"
                      returnKeyType="go"
                      onSubmitEditing={submit}
                      editable={!busy}
                      style={[styles.textInput, { color: colors.text }]}
                    />
                    <Pressable
                      onPress={togglePasswordVisibility}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      hitSlop={8}
                      style={styles.actionIcon}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={focused === 'password' ? palette.primary : colors.muted}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Preferencias de cuenta (Recordar / Biometría) */}
                <View style={styles.switchesContainer}>
                  <Pressable
                    onPress={toggleRememberEmail}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: rememberEmail }}
                    style={({ pressed }) => [
                      styles.switchRow,
                      {
                        backgroundColor: isDark ? 'rgba(30,41,59,0.45)' : '#F8FAFC',
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}>
                    <View style={styles.switchLeft}>
                      <Ionicons
                        name="mail"
                        size={17}
                        color={rememberEmail ? palette.primary : colors.muted}
                      />
                      <Text style={[styles.switchLabel, { color: colors.text }]}>Recordar mi correo</Text>
                    </View>
                    <Ionicons
                      name={rememberEmail ? 'checkmark-circle' : 'ellipse-outline'}
                      size={21}
                      color={rememberEmail ? palette.primary : colors.muted}
                    />
                  </Pressable>


                </View>

                {/* Alerta de Error */}
                {error && (
                  <View accessibilityRole="alert" style={styles.errorCard}>
                    <Ionicons name="alert-circle" size={20} color={palette.danger} style={{ marginTop: 1 }} />
                    <Text style={styles.errorCardText}>{error}</Text>
                  </View>
                )}

                {/* Botón Principal */}
                <Pressable
                  onPress={submit}
                  disabled={!canSubmit}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canSubmit, busy }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      backgroundColor: canSubmit ? palette.primary : isDark ? '#1E293B' : '#E2E8F0',
                      opacity: !canSubmit ? 0.6 : pressed ? 0.88 : 1,
                    },
                  ]}>
                  {busy ? (
                    <View style={styles.buttonCenter}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.buttonText}>Verificando credenciales…</Text>
                    </View>
                  ) : (
                    <View style={styles.buttonCenter}>
                      <Text
                        style={[
                          styles.buttonText,
                          { color: canSubmit ? '#FFFFFF' : colors.muted },
                        ]}>
                        Entrar a mi comercio
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color={canSubmit ? '#FFFFFF' : colors.muted}
                      />
                    </View>
                  )}
                </Pressable>

                {hint && <Text style={[styles.formHint, { color: colors.muted }]}>{hint}</Text>}
              </View>

              {/* Pie de pantalla / Seguridad */}
              <View style={styles.footerContainer}>
                <View style={styles.securityBadge}>
                  <Ionicons name="shield-checkmark-outline" size={15} color={colors.muted} />
                  <Text style={[styles.securityText, { color: colors.muted }]}>
                    Conexión segura cifrada de punto a punto
                  </Text>
                </View>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  ambientGlow: {
    position: 'absolute',
    top: -120,
    left: '10%',
    right: '10%',
    height: 320,
    borderRadius: 160,
    transform: [{ scaleX: 1.6 }],
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  brandContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
    overflow: 'hidden',
  },
  brandIconImage: {
    width: 68,
    height: 68,
    borderRadius: 22,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  brandSub: {
    fontSize: 14,
    fontWeight: '500',
  },
  quickBioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1.5,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  quickBioLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  quickBioIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBioTextContainer: { flex: 1, gap: 2 },
  quickBioTitle: { fontSize: 15, fontWeight: '700' },
  quickBioEmail: { fontSize: 13, fontWeight: '500' },
  quickBioButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 11,
  },
  quickBioButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 2,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerLabel: { fontSize: 13, fontWeight: '500' },
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    gap: 18,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  formHeader: { gap: 4 },
  formTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  formSubtitle: { fontSize: 13, lineHeight: 18 },
  inputGroup: { gap: 7 },
  inputLabel: { fontSize: 13, fontWeight: '700' },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotLink: { fontSize: 12, fontWeight: '700' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    paddingHorizontal: 14,
    height: 52,
  },
  fieldIcon: { marginRight: 10 },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    height: '100%',
  },
  actionIcon: { padding: 4 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  fieldErrorText: { color: palette.danger, fontSize: 12, fontWeight: '600' },
  switchesContainer: { gap: 8, marginTop: 2 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  switchLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { fontSize: 13, fontWeight: '600' },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
    borderRadius: 14,
    padding: 12,
  },
  errorCardText: {
    flex: 1,
    color: palette.danger,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  primaryButton: {
    height: 52,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 2,
  },
  buttonCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 15, fontWeight: '800' },
  formHint: { textAlign: 'center', fontSize: 12, marginTop: -4 },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.85,
  },
  securityText: { fontSize: 12, fontWeight: '500' },
});
