import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, usePalette } from '@/lib/palette';
import {
  QUALITY_CHECKS,
  QUALITY_RESULTS,
  QUALITY_SUGGESTIONS,
  submitQualityCheck,
  type QualityChecklist,
  type QualityResult,
  type Repair,
} from '@/lib/repairs';

const EMPTY: QualityChecklist = {
  powersOn: false,
  reportedIssueResolved: false,
  basicFunctions: false,
  physicalCondition: false,
  accessoriesVerified: false,
};

/**
 * Verificación previa a la entrega, igual que la de la web: es lo que pide el
 * servidor antes de marcar un equipo como listo. Si aprueba, queda listo; si
 * falla, vuelve a reparación; sin solución o retiro, queda listo para retiro.
 */
export function QualityCheckSheet({
  repair,
  visible,
  onClose,
  onSaved,
}: {
  repair: Repair;
  visible: boolean;
  onClose: () => void;
  onSaved: (repair: Repair, result: QualityResult) => void;
}) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const [result, setResult] = useState<QualityResult>('passed');
  const [checklist, setChecklist] = useState<QualityChecklist>(EMPTY);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = QUALITY_CHECKS.every(({ key }) => checklist[key]);
  const complete = result === 'passed' ? allChecked : note.trim().length >= 5;
  const option = QUALITY_RESULTS.find((item) => item.key === result)!;
  const suggestions =
    result === 'failed' && repair.problem_description?.trim()
      ? [`Persiste la falla reportada: ${repair.problem_description.trim()}`, ...QUALITY_SUGGESTIONS.failed]
      : QUALITY_SUGGESTIONS[result];

  const reset = () => {
    setResult('passed');
    setChecklist(EMPTY);
    setNote('');
    setError(null);
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const applySuggestion = (suggestion: string) => {
    setNote((current) => {
      const trimmed = current.trim();
      if (!trimmed) return suggestion;
      if (trimmed.includes(suggestion)) return trimmed;
      return `${trimmed.replace(/\.*$/, '')}. ${suggestion}`;
    });
  };

  const submit = async () => {
    if (!complete || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await submitQualityCheck(repair.id, { result, checklist, note });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(updated, result);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la verificación técnica.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cerrar verificación" />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>Verificación técnica</Text>
              <Text style={[styles.small, { color: colors.muted }]}>Probá el equipo antes de marcarlo como listo.</Text>
            </View>
            <Pressable onPress={close} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {/* Resultado */}
            <Text style={[styles.label, { color: colors.text }]}>Resultado</Text>
            <View style={styles.results}>
              {QUALITY_RESULTS.map((item) => {
                const selected = item.key === result;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      setResult(item.key);
                      setError(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.result,
                      { borderColor: selected ? item.color : colors.border, backgroundColor: selected ? `${item.color}14` : colors.background },
                    ]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                    <Text style={[styles.resultText, { color: selected ? item.color : colors.text }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Checklist: obligatorio completo para aprobar */}
            {result === 'passed' && (
              <View style={styles.block}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.label, { color: colors.text }]}>Checklist</Text>
                  <Pressable onPress={() => setChecklist(allChecked ? EMPTY : Object.fromEntries(QUALITY_CHECKS.map(({ key }) => [key, true])) as QualityChecklist)} hitSlop={8}>
                    <Text style={[styles.link, { color: palette.primary }]}>{allChecked ? 'Desmarcar todo' : 'Marcar todo'}</Text>
                  </Pressable>
                </View>
                {QUALITY_CHECKS.map(({ key, label }) => {
                  const checked = checklist[key];
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setChecklist((current) => ({ ...current, [key]: !current[key] }));
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      style={[styles.check, { borderColor: checked ? '#16A34A' : colors.border, backgroundColor: checked ? '#16A34A12' : colors.background }]}>
                      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? '#16A34A' : colors.muted} />
                      <Text style={[styles.checkText, { color: colors.text }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Observación: obligatoria si no aprueba */}
            <View style={styles.block}>
              <Text style={[styles.label, { color: colors.text }]}>
                {result === 'passed' ? 'Observación (opcional)' : 'Observación (obligatoria)'}
              </Text>
              <View style={styles.suggestions}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => applySuggestion(suggestion)}
                    style={[styles.suggestion, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Ionicons name="add" size={13} color={colors.muted} />
                    <Text style={[styles.suggestionText, { color: colors.text }]}>{suggestion}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={result === 'passed' ? 'Algo para anotar en la orden' : 'Contá qué pasó (mínimo 5 letras)'}
                placeholderTextColor={colors.muted}
                multiline
                maxLength={2000}
                accessibilityLabel="Observación"
                style={[styles.note, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <Pressable
            onPress={submit}
            disabled={!complete || saving}
            style={[styles.submit, { backgroundColor: option.color, opacity: !complete || saving ? 0.5 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name={option.icon} size={19} color="#fff" />}
            <Text style={styles.submitText}>{option.submit}</Text>
          </Pressable>
          {!complete && (
            <Text style={[styles.hint, { color: colors.muted }]}>
              {result === 'passed' ? 'Marcá todos los puntos del checklist para aprobar.' : 'Escribí una observación de al menos 5 letras.'}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.45)' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  title: { fontSize: 19, fontWeight: '800' },
  small: { fontSize: 12, marginTop: 2 },
  body: { gap: 12, paddingBottom: 12 },
  label: { fontSize: 14, fontWeight: '800' },
  link: { fontSize: 13, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  results: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  result: { width: '48.5%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 10, minHeight: 54 },
  resultText: { flex: 1, fontSize: 13, fontWeight: '700' },
  block: { gap: 8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  checkText: { fontSize: 14, fontWeight: '600' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  suggestionText: { fontSize: 12 },
  note: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 84, fontSize: 15, textAlignVertical: 'top' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, minHeight: 52, marginTop: 4 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  hint: { textAlign: 'center', fontSize: 12, marginTop: 6 },
});
