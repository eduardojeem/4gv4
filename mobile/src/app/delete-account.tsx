import { useEffect, useRef, useState } from 'react';
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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { apiFetch } from '@/lib/api';
import { palette, usePalette } from '@/lib/palette';
import { useSession } from '@/lib/session';
import { openWeb } from '@/lib/marketplace';

const CONFIRM_WORD = 'ELIMINAR';

type Impact = {
  email: string | null;
  pending: { scheduledFor: string } | null;
  closesOrganizations: { id: string; name: string }[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Eliminar la cuenta desde la app (lo exige Google Play). Usa la misma API que
 * la página web /saas/eliminar-cuenta: bloquea la cuenta en el momento y a los
 * 30 días borra los datos personales.
 */
export default function DeleteAccountScreen() {
  const colors = usePalette();
  const isDark = useColorScheme() === 'dark';
  const { signOut } = useSession();
  const sending = useRef(false);

  const [impact, setImpact] = useState<Impact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Impact>('/api/account/delete')
      .then(setImpact)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudo cargar la información de la cuenta.'));
  }, []);

  const canSubmit = Boolean(password) && confirm.trim().toUpperCase() === CONFIRM_WORD && !busy;

  const submit = async () => {
    Keyboard.dismiss();
    if (!canSubmit || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ scheduledFor: string }>('/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ password, confirm, source: 'app' }),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScheduledFor(result.scheduledFor);
      AccessibilityInfo.announceForAccessibility('Tu cuenta quedó bloqueada.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo registrar el pedido. Probá de nuevo.';
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const finish = async () => {
    await signOut().catch(() => undefined);
    router.replace('/');
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/panel/profile' as never));
  const inputStyle = [styles.inputWrapper, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {!scheduledFor && (
              <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Volver al perfil" hitSlop={10} style={styles.back}>
                <Ionicons name="arrow-back" size={20} color={colors.text} />
                <Text style={[styles.backText, { color: colors.text }]}>Volver</Text>
              </Pressable>
            )}

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.iconCircle}>
                <Ionicons name={scheduledFor ? 'checkmark-circle-outline' : 'trash-outline'} size={26} color={palette.danger} />
              </View>

              {scheduledFor ? (
                <>
                  <Text style={[styles.title, { color: colors.text }]}>Cuenta bloqueada</Text>
                  <Text style={[styles.body, { color: colors.muted }]}>
                    Tus datos personales se eliminan el {formatDate(scheduledFor)}. Te mandamos la confirmación por correo.
                  </Text>
                  <Pressable onPress={finish} accessibilityRole="button" style={({ pressed }) => [styles.dangerButton, { opacity: pressed ? 0.88 : 1 }]}>
                    <Text style={styles.buttonText}>Salir</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[styles.title, { color: colors.text }]}>Eliminar tu cuenta</Text>
                  <Text style={[styles.body, { color: colors.muted }]}>
                    La cuenta se bloquea en el momento y a los 30 días se eliminan tus datos personales (nombre, correo, teléfono, foto y preferencias). Los registros comerciales y fiscales de los negocios se conservan sin tus datos, como exige la ley.
                  </Text>

                  {loadError && <Text style={styles.errorText}>{loadError}</Text>}
                  {!impact && !loadError && <ActivityIndicator color={palette.primary} />}

                  {impact?.pending ? (
                    <Text style={[styles.body, { color: colors.text }]}>
                      Ya pediste eliminar esta cuenta. Tus datos se eliminan el {formatDate(impact.pending.scheduledFor)}.
                    </Text>
                  ) : impact ? (
                    <>
                      {impact.closesOrganizations.length > 0 && (
                        <View style={styles.warningCard}>
                          <Ionicons name="warning-outline" size={20} color="#B45309" />
                          <Text style={styles.warningText}>
                            Sos el único administrador de {impact.closesOrganizations.map((org) => org.name).join(', ')}. Si seguís, ese negocio se cierra. Para que siga funcionando, primero sumá a otra persona como administrador.
                          </Text>
                        </View>
                      )}

                      <View style={inputStyle}>
                        <Ionicons name="lock-closed-outline" size={19} color={colors.muted} style={styles.fieldIcon} />
                        <TextInput
                          value={password}
                          onChangeText={(value) => { setPassword(value); setError(null); }}
                          accessibilityLabel="Contraseña"
                          placeholder="Tu contraseña"
                          placeholderTextColor={colors.muted}
                          secureTextEntry
                          autoCapitalize="none"
                          autoComplete="current-password"
                          textContentType="password"
                          editable={!busy}
                          style={[styles.textInput, { color: colors.text }]}
                        />
                      </View>
                      <View style={inputStyle}>
                        <TextInput
                          value={confirm}
                          onChangeText={(value) => { setConfirm(value); setError(null); }}
                          accessibilityLabel={`Escribí ${CONFIRM_WORD} para confirmar`}
                          placeholder={`Escribí ${CONFIRM_WORD} para confirmar`}
                          placeholderTextColor={colors.muted}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          editable={!busy}
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
                        disabled={!canSubmit}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !canSubmit, busy }}
                        style={({ pressed }) => [styles.dangerButton, { opacity: !canSubmit ? 0.5 : pressed ? 0.88 : 1 }]}>
                        {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.buttonText}>Eliminar mi cuenta</Text>}
                      </Pressable>
                    </>
                  ) : null}

                  <Pressable onPress={() => void openWeb('/saas/eliminar-cuenta')} accessibilityRole="link" hitSlop={8}>
                    <Text style={[styles.link, { color: palette.primary }]}>Más información</Text>
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
  iconCircle: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(220, 38, 38, 0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  body: { fontSize: 14, lineHeight: 20 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, paddingHorizontal: 14, height: 52 },
  fieldIcon: { marginRight: 10 },
  textInput: { flex: 1, fontSize: 15, paddingVertical: 0, height: '100%' },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 14,
    padding: 12,
  },
  warningText: { flex: 1, color: '#B45309', fontSize: 13, fontWeight: '600', lineHeight: 18 },
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
  dangerButton: { height: 52, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.danger },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  link: { textAlign: 'center', fontSize: 14, fontWeight: '700' },
});
