import { useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { apiFetch } from '@/lib/api';
import { palette, usePalette } from '@/lib/palette';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Pedir el correo para crear una contraseña nueva sin salir de la app.
 *
 * Antes «¿Olvidaste?» abría el login de la web en el navegador y había que
 * buscar ahí la opción. El pedido pasa por el servidor, igual que el login,
 * porque Supabase exige un captcha que solo corre en la web. El enlace del
 * correo abre la página web para elegir la contraseña nueva; después se vuelve
 * a la app y se ingresa con ella.
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const colors = usePalette();
  const isDark = useColorScheme() === 'dark';
  const sending = useRef(false);

  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = emailValid && !busy;

  const submit = async () => {
    Keyboard.dismiss();
    if (!canSubmit || sending.current) {
      if (!emailValid) setError('Escribí el email con el que entrás (ej. usuario@gmail.com).');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/mobile/auth/password-reset', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email: email.trim() }),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSentTo(email.trim());
      AccessibilityInfo.announceForAccessibility('Te enviamos un enlace a tu correo.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo enviar el correo. Probá de nuevo.';
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/sign-in' as never));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Volver al inicio de sesión" hitSlop={10} style={styles.back}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
              <Text style={[styles.backText, { color: colors.text }]}>Volver</Text>
            </Pressable>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.iconCircle}>
                <Ionicons name={sentTo ? 'mail-open-outline' : 'key-outline'} size={26} color={palette.primary} />
              </View>

              {sentTo ? (
                <>
                  <Text style={[styles.title, { color: colors.text }]}>Revisá tu correo</Text>
                  <Text style={[styles.body, { color: colors.muted }]}>
                    Si <Text style={{ color: colors.text, fontWeight: '700' }}>{sentTo}</Text> está registrado, te llegará un enlace para crear una contraseña nueva. Abrilo, elegí la contraseña y volvé a la app para ingresar con ella.
                  </Text>
                  <Text style={[styles.body, { color: colors.muted }]}>
                    ¿No llega? Mirá en spam o correo no deseado. El enlace vence en poco tiempo.
                  </Text>
                  <Pressable
                    onPress={goBack}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.88 : 1 }]}>
                    <Text style={styles.buttonText}>Volver a iniciar sesión</Text>
                  </Pressable>
                  <Pressable onPress={() => setSentTo(null)} accessibilityRole="button" hitSlop={8}>
                    <Text style={[styles.link, { color: palette.primary }]}>Usar otro email</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[styles.title, { color: colors.text }]}>Recuperar contraseña</Text>
                  <Text style={[styles.body, { color: colors.muted }]}>
                    Escribí el email con el que entrás y te mandamos un enlace para crear una contraseña nueva.
                  </Text>

                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                        borderColor: focused ? palette.primary : isDark ? '#334155' : '#E2E8F0',
                        borderWidth: focused ? 1.5 : 1,
                      },
                    ]}>
                    <Ionicons name="mail-outline" size={19} color={focused ? palette.primary : colors.muted} style={styles.fieldIcon} />
                    <TextInput
                      value={email}
                      onChangeText={(value) => { setEmail(value); setError(null); }}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      accessibilityLabel="Correo electrónico"
                      placeholder="nombre@mitienda.com"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="username"
                      returnKeyType="send"
                      onSubmitEditing={submit}
                      editable={!busy}
                      autoFocus={!email}
                      style={[styles.textInput, { color: colors.text }]}
                    />
                  </View>

                  {error && (
                    <View accessibilityRole="alert" style={styles.errorCard}>
                      <Ionicons name="alert-circle" size={20} color={palette.danger} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  <Pressable
                    onPress={submit}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSubmit, busy }}
                    style={({ pressed }) => [styles.primaryButton, { opacity: !canSubmit ? 0.6 : pressed ? 0.88 : 1 }]}>
                    {busy ? (
                      <View style={styles.buttonCenter}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.buttonText}>Enviando…</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>Enviar enlace</Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxWidth: 480, width: '100%', alignSelf: 'center', gap: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { fontSize: 15, fontWeight: '600' },
  card: { borderRadius: 24, borderWidth: 1, padding: 22, gap: 16 },
  iconCircle: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(37, 99, 235, 0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  body: { fontSize: 14, lineHeight: 20 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, paddingHorizontal: 14, height: 52 },
  fieldIcon: { marginRight: 10 },
  textInput: { flex: 1, fontSize: 15, paddingVertical: 0, height: '100%' },
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
  errorText: { flex: 1, color: palette.danger, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  primaryButton: { height: 52, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.primary },
  buttonCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  link: { textAlign: 'center', fontSize: 14, fontWeight: '700' },
});
