import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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
import { authenticateWithBiometrics, getBiometricSupport } from '@/lib/biometric-lock';
import { palette, usePalette } from '@/lib/palette';
import { useSession } from '@/lib/session';
import { openWeb } from '@/lib/marketplace';

const CONFIRM_WORD = 'ELIMINAR';
/** Cuánto hay que mantener apretado el botón final: un toque sin querer no alcanza. */
const HOLD_TO_DELETE_MS = 3000;

type Impact = {
  email: string | null;
  pending: { scheduledFor: string } | null;
  closesOrganizations: { id: string; name: string }[];
  supportEmail?: string;
};

type Step = 'review' | 'confirm';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Eliminar la cuenta desde la app (lo exige Google Play), en dos pasos para que
 * no pase sin querer:
 * 1. Qué se pierde, qué se conserva y alternativas, con casillas que hay que marcar.
 * 2. Contraseña, escribir ELIMINAR, mantener apretado el botón y, si el teléfono
 *    tiene huella o Face ID, confirmar con eso.
 * Usa la misma API que /saas/eliminar-cuenta: bloquea la cuenta en el momento y
 * a los 30 días borra los datos personales.
 */
export default function DeleteAccountScreen() {
  const colors = usePalette();
  const isDark = useColorScheme() === 'dark';
  const { signOut } = useSession();
  const sending = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const [impact, setImpact] = useState<Impact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('review');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
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

  const closes = impact?.closesOrganizations ?? [];
  const closesNames = closes.map((org) => org.name).join(', ');
  const supportEmail = impact?.supportEmail || 'soporte@mitiendapy.com';
  const acknowledgements = [
    { key: 'access', text: 'Entiendo que pierdo el acceso a Mi TiendaPy en todos mis dispositivos desde ahora.' },
    { key: 'data', text: 'Entiendo que a los 30 días se borran mis datos personales y no se pueden recuperar.' },
    ...(closes.length
      ? [{ key: 'business', text: `Entiendo que ${closesNames} se cierra para todo el equipo: la tienda online deja de verse y el plan se cancela.` }]
      : []),
  ];
  const allChecked = acknowledgements.every((item) => checks[item.key]);
  const confirmMatches = confirm.trim().toUpperCase() === CONFIRM_WORD;
  const canHold = Boolean(password) && confirmMatches && !busy;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/panel/profile' as never));

  const toggle = (key: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const continueToConfirm = () => {
    if (!allChecked) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    setStep('confirm');
    setError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const submit = async () => {
    Keyboard.dismiss();
    if (!canHold || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      // Último control: la huella o Face ID del dueño del teléfono, si lo tiene configurado.
      const biometrics = await getBiometricSupport(Platform.OS);
      if (biometrics.available) {
        const ok = await authenticateWithBiometrics(biometrics.label, 'Confirmá que querés eliminar tu cuenta');
        if (!ok) {
          setError(`No se confirmó con ${biometrics.label}. Tu cuenta sigue activa.`);
          return;
        }
      }
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

  const inputStyle = [styles.inputWrapper, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {!scheduledFor && (
              <Pressable
                onPress={step === 'confirm' && !busy ? () => setStep('review') : goBack}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={step === 'confirm' ? 'Volver al paso anterior' : 'Volver al perfil'}
                hitSlop={10}
                style={styles.back}>
                <Ionicons name="arrow-back" size={20} color={colors.text} />
                <Text style={[styles.backText, { color: colors.text }]}>Volver</Text>
              </Pressable>
            )}

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.iconCircle}>
                <Ionicons name={scheduledFor ? 'checkmark-circle-outline' : 'warning-outline'} size={26} color={palette.danger} />
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
                  {!!impact && !impact.pending && (
                    <Text style={[styles.stepLabel, { color: colors.muted }]}>Paso {step === 'review' ? 1 : 2} de 2</Text>
                  )}
                  <Text style={[styles.title, { color: colors.text }]}>
                    {step === 'review' ? 'Antes de eliminar tu cuenta' : 'Confirmá que sos vos'}
                  </Text>

                  {loadError && <Text style={styles.errorText}>{loadError}</Text>}
                  {!impact && !loadError && <ActivityIndicator color={palette.primary} />}

                  {impact?.pending ? (
                    <Text style={[styles.body, { color: colors.text }]}>
                      Ya pediste eliminar esta cuenta. Tus datos se eliminan el {formatDate(impact.pending.scheduledFor)}.
                    </Text>
                  ) : impact && step === 'review' ? (
                    <>
                      <View style={styles.list}>
                        <Consequence icon="lock-closed-outline" tone="danger" text="La cuenta se bloquea en el momento: no vas a poder entrar en ningún dispositivo." colors={colors} />
                        <Consequence icon="trash-outline" tone="danger" text="A los 30 días se borran tu nombre, correo, teléfono, foto y preferencias. No se puede deshacer." colors={colors} />
                        <Consequence icon="document-text-outline" tone="muted" text="Las ventas, cajas y facturas de los negocios se conservan sin tus datos, como exige la ley." colors={colors} />
                      </View>

                      {closes.length > 0 && (
                        <View style={styles.warningCard} accessibilityRole="alert">
                          <Ionicons name="business-outline" size={20} color="#B45309" />
                          <View style={styles.flex}>
                            <Text style={styles.warningTitle}>Se cierra {closesNames}</Text>
                            <Text style={styles.warningText}>
                              Sos el único administrador. Si seguís, el negocio deja de funcionar para todo el equipo, la tienda online se despublica y el plan se cancela.
                            </Text>
                          </View>
                        </View>
                      )}

                      <View style={[styles.alternatives, { borderColor: colors.border }]}>
                        <Text style={[styles.altTitle, { color: colors.text }]}>¿Querés otra cosa?</Text>
                        {closes.length > 0 && (
                          <Alternative icon="person-add-outline" text="Sumar otro administrador para que el negocio siga" onPress={() => router.push('/admin/users' as never)} colors={colors} />
                        )}
                        <Alternative icon="log-out-outline" text="Solo cerrar sesión en este teléfono" onPress={() => void finish()} colors={colors} />
                        <Alternative
                          icon="chatbubble-ellipses-outline"
                          text="Contarnos qué pasó a soporte"
                          onPress={() => void Linking.openURL(`mailto:${supportEmail}?subject=${encodeURIComponent('Quiero eliminar mi cuenta')}`).catch(() => undefined)}
                          colors={colors}
                        />
                      </View>

                      <View style={styles.list}>
                        {acknowledgements.map((item) => {
                          const checked = Boolean(checks[item.key]);
                          return (
                            <Pressable
                              key={item.key}
                              onPress={() => toggle(item.key)}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked }}
                              style={[styles.checkRow, { borderColor: checked ? palette.danger : colors.border }]}>
                              <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? palette.danger : colors.muted} />
                              <Text style={[styles.checkText, { color: colors.text }]}>{item.text}</Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <Pressable onPress={goBack} accessibilityRole="button" style={({ pressed }) => [styles.safeButton, { opacity: pressed ? 0.88 : 1 }]}>
                        <Text style={styles.buttonText}>Conservar mi cuenta</Text>
                      </Pressable>
                      <Pressable
                        onPress={continueToConfirm}
                        disabled={!allChecked}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !allChecked }}
                        style={[styles.outlineDanger, { opacity: allChecked ? 1 : 0.45 }]}>
                        <Text style={[styles.outlineDangerText]}>Continuar con la eliminación</Text>
                      </Pressable>
                    </>
                  ) : impact ? (
                    <>
                      <Text style={[styles.body, { color: colors.muted }]}>
                        Vas a eliminar <Text style={{ color: colors.text, fontWeight: '800' }}>{impact.email ?? 'esta cuenta'}</Text>. Escribí tu contraseña y {CONFIRM_WORD} para confirmar.
                      </Text>

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
                      <View style={[...inputStyle, confirmMatches && { borderColor: palette.danger }]}>
                        <TextInput
                          value={confirm}
                          onChangeText={(value) => { setConfirm(value); setError(null); }}
                          accessibilityLabel={`Escribí ${CONFIRM_WORD} para confirmar`}
                          placeholder={`Escribí ${CONFIRM_WORD}`}
                          placeholderTextColor={colors.muted}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          contextMenuHidden
                          editable={!busy}
                          style={[styles.textInput, { color: colors.text }]}
                        />
                        {confirmMatches && <Ionicons name="checkmark-circle" size={20} color={palette.danger} />}
                      </View>

                      {error && (
                        <View accessibilityRole="alert" style={styles.errorCard}>
                          <Ionicons name="alert-circle" size={20} color={palette.danger} />
                          <Text style={styles.errorText}>{error}</Text>
                        </View>
                      )}

                      <HoldToDeleteButton disabled={!canHold} busy={busy} onConfirmed={() => void submit()} />
                      <Text style={[styles.hint, { color: colors.muted }]}>
                        Mantené apretado el botón 3 segundos. Si soltás antes, no pasa nada.
                      </Text>

                      <Pressable onPress={goBack} disabled={busy} accessibilityRole="button" style={styles.cancelLink} hitSlop={8}>
                        <Text style={[styles.link, { color: palette.primary }]}>No, conservar mi cuenta</Text>
                      </Pressable>
                    </>
                  ) : null}

                  <Pressable onPress={() => void openWeb('/saas/eliminar-cuenta')} accessibilityRole="link" hitSlop={8}>
                    <Text style={[styles.link, { color: colors.muted }]}>Más información</Text>
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

function Consequence({ icon, text, tone, colors }: { icon: keyof typeof Ionicons.glyphMap; text: string; tone: 'danger' | 'muted'; colors: ReturnType<typeof usePalette> }) {
  return (
    <View style={styles.consequence}>
      <Ionicons name={icon} size={18} color={tone === 'danger' ? palette.danger : colors.muted} />
      <Text style={[styles.body, styles.flex, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

function Alternative({ icon, text, onPress, colors }: { icon: keyof typeof Ionicons.glyphMap; text: string; onPress: () => void; colors: ReturnType<typeof usePalette> }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.altRow, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={18} color={palette.primary} />
      <Text style={[styles.altText, { color: palette.primary }]}>{text}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

/** Botón que se llena mientras se mantiene apretado; soltarlo antes de tiempo lo vacía y no hace nada. */
function HoldToDeleteButton({ disabled, busy, onConfirmed }: { disabled: boolean; busy: boolean; onConfirmed: () => void }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [holding, setHolding] = useState(false);

  const start = () => {
    if (disabled) return;
    setHolding(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    Animated.timing(progress, { toValue: 1, duration: HOLD_TO_DELETE_MS, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      setHolding(false);
      if (!finished) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
      progress.setValue(0);
      onConfirmed();
    });
  };

  const cancel = () => {
    if (!holding) return;
    progress.stopAnimation();
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  return (
    <Pressable
      onPressIn={start}
      onPressOut={cancel}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Mantener apretado para eliminar mi cuenta"
      accessibilityHint="Mantené apretado tres segundos para confirmar"
      accessibilityState={{ disabled, busy }}
      // Con lector de pantalla no se puede mantener apretado: el gesto de activar confirma.
      onAccessibilityAction={(event) => event.nativeEvent.actionName === 'activate' && !disabled && onConfirmed()}
      accessibilityActions={[{ name: 'activate' }]}
      style={[styles.holdButton, { opacity: disabled ? 0.45 : 1 }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.holdFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
      />
      {busy ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <View style={styles.holdLabel}>
          <Ionicons name="finger-print-outline" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>{holding ? 'Seguí apretando…' : 'Mantené apretado para eliminar'}</Text>
        </View>
      )}
    </Pressable>
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
  stepLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: -10 },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  body: { fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: -6 },
  list: { gap: 10 },
  consequence: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
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
  warningTitle: { color: '#B45309', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  warningText: { color: '#B45309', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  alternatives: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  altTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  altRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  altText: { flex: 1, fontSize: 14, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  checkText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
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
  safeButton: { height: 52, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.primary },
  outlineDanger: { height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: palette.danger, marginTop: -4 },
  outlineDangerText: { color: palette.danger, fontSize: 14, fontWeight: '800' },
  dangerButton: { height: 52, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.danger },
  holdButton: { height: 56, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: '#7F1D1D', overflow: 'hidden' },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: palette.danger },
  holdLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cancelLink: { alignItems: 'center', paddingVertical: 4 },
  link: { textAlign: 'center', fontSize: 14, fontWeight: '700' },
});
