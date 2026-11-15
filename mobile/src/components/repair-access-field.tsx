import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PatternPicker } from '@/components/pattern-picker';
import { usePalette } from '@/lib/palette';
import {
  MAX_REPAIR_ACCESS_LENGTH,
  pinValidationMeta,
  type AccessType,
} from '@/lib/repair-access';
import { ACCESS_TYPES } from '@/lib/repairs';

type Colors = ReturnType<typeof usePalette>;

const OTHER_PRESETS = [
  'Clave anotada en funda / tapa',
  'Cliente desbloquea en local',
  'Cuenta Google / iCloud activa',
  'Doble espacio / carpeta segura',
] as const;

function accessTone(type: AccessType, colors: Colors): string {
  switch (type) {
    case 'none':
      return colors.successText;
    case 'pin':
      return colors.accent;
    case 'pattern':
      return colors.isDark ? '#A78BFA' : '#7C3AED';
    case 'password':
      return colors.isDark ? '#34D399' : '#059669';
    case 'biometric':
      return colors.warningText;
    case 'other':
      return colors.isDark ? '#94A3B8' : '#475569';
  }
}

/**
 * Selector y campo unificado de desbloqueo del dispositivo (Sin bloqueo, PIN,
 * Patrón, Contraseña, Biométrico u Otro). Mantiene borradores por tipo para
 * evitar fugas entre formatos al cambiar de pestaña y alinea todos los límites
 * con el backend (`maxLength = 100`).
 */
export function RepairAccessField({
  accessType,
  accessPassword,
  onChangeType,
  onChangePassword,
  error,
  onDrawingChange,
  disabled = false,
}: {
  accessType: AccessType;
  accessPassword: string;
  onChangeType: (nextType: AccessType, nextPassword: string) => void;
  onChangePassword: (nextPassword: string) => void;
  error?: string | null;
  onDrawingChange?: (drawing: boolean) => void;
  disabled?: boolean;
}) {
  const colors = usePalette();
  const [showSecret, setShowSecret] = useState(true);
  const [drafts, setDrafts] = useState<Partial<Record<AccessType, string>>>({});

  const selectType = (nextType: AccessType) => {
    if (disabled || nextType === accessType) return;
    void Haptics.selectionAsync();

    // Guardar borrador del tipo anterior para no perder lo escrito si tocó otra opción sin querer.
    setDrafts((prev) => ({
      ...prev,
      ...(accessType !== 'none' && accessType !== 'biometric' ? { [accessType]: accessPassword } : {}),
    }));

    const restored =
      nextType === 'none' || nextType === 'biometric'
        ? ''
        : (drafts[nextType] ?? '');
    onChangeType(nextType, restored);
  };

  const updatePassword = (nextValue: string) => {
    const trimmedMax = nextValue.slice(0, MAX_REPAIR_ACCESS_LENGTH);
    setDrafts((prev) => ({ ...prev, [accessType]: trimmedMax }));
    onChangePassword(trimmedMax);
  };

  const appendSecondPin = () => {
    if (disabled) return;
    const trimmed = accessPassword.trimEnd();
    if (!/\d/.test(trimmed)) return;
    if (trimmed.endsWith(',') || trimmed.endsWith('/')) return;
    const addition = `${trimmed}, `;
    if (addition.length > MAX_REPAIR_ACCESS_LENGTH) return;
    void Haptics.selectionAsync();
    updatePassword(addition);
  };

  const applyOtherPreset = (preset: string) => {
    if (disabled) return;
    void Haptics.selectionAsync();
    const current = accessPassword.trim();
    if (!current) {
      updatePassword(preset.slice(0, MAX_REPAIR_ACCESS_LENGTH));
      return;
    }
    if (current.toLowerCase().includes(preset.toLowerCase())) return;
    const combined = `${current}. ${preset}`;
    if (combined.length <= MAX_REPAIR_ACCESS_LENGTH) {
      updatePassword(combined);
    }
  };

  const pinMeta = accessType === 'pin' ? pinValidationMeta(accessPassword) : null;
  const rows = [ACCESS_TYPES.slice(0, 3), ACCESS_TYPES.slice(3, 6)] as const;

  return (
    <View style={styles.wrap}>
      {/* Grilla 3×2 simétrica para seleccionar método de desbloqueo */}
      <View style={styles.typeGrid} accessibilityRole="radiogroup" accessibilityLabel="Tipo de desbloqueo del equipo">
        {rows.map((row, rowIndex) => (
          <View key={`access-row-${rowIndex}`} style={styles.typeRow}>
            {row.map((type) => {
              const selected = accessType === type.key;
              const tone = accessTone(type.key, colors);
              return (
                <Pressable
                  key={type.key}
                  onPress={() => selectType(type.key)}
                  disabled={disabled}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${type.label}: ${type.hint}`}
                  style={({ pressed }) => [
                    styles.typeCard,
                    {
                      borderColor: selected ? tone : colors.border,
                      backgroundColor: selected
                        ? `${tone}${colors.isDark ? '24' : '12'}`
                        : pressed
                          ? colors.card
                          : colors.background,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.typeIconWrap,
                      {
                        backgroundColor: selected
                          ? `${tone}${colors.isDark ? '33' : '22'}`
                          : colors.card,
                      },
                    ]}
                  >
                    <Ionicons name={type.icon} size={17} color={selected ? tone : colors.muted} />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.typeLabel,
                      { color: selected ? tone : colors.text },
                      selected && styles.typeLabelSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {accessType === 'none' && (
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: `${colors.successText}${colors.isDark ? '18' : '12'}`,
              borderColor: `${colors.successText}${colors.isDark ? '44' : '38'}`,
            },
          ]}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.successText} />
          <View style={styles.flex}>
            <Text style={[styles.infoTitle, { color: colors.successText }]}>Sin bloqueo de pantalla</Text>
            <Text style={[styles.infoText, { color: colors.text }]}>
              El equipo se puede probar libremente sin pedir contraseña ni patrón.
            </Text>
          </View>
        </View>
      )}

      {accessType === 'biometric' && (
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: `${colors.warningText}${colors.isDark ? '18' : '12'}`,
              borderColor: `${colors.warningText}${colors.isDark ? '44' : '38'}`,
            },
          ]}
        >
          <Ionicons name="finger-print-outline" size={20} color={colors.warningText} />
          <View style={styles.flex}>
            <Text style={[styles.infoTitle, { color: colors.warningText }]}>Acceso biométrico (Huella / Rostro)</Text>
            <Text style={[styles.infoText, { color: colors.text }]}>
              El cliente debe desbloquear el equipo o dejar una clave alternativa si requiere pruebas sin su presencia.
            </Text>
            <Pressable
              onPress={() => selectType('pin')}
              hitSlop={6}
              style={styles.switchHintBtn}
              accessibilityRole="button"
            >
              <Ionicons name="keypad-outline" size={13} color={colors.accent} />
              <Text style={[styles.switchHintText, { color: colors.accent }]}>Cargar PIN de respaldo</Text>
            </Pressable>
          </View>
        </View>
      )}

      {accessType === 'pin' && pinMeta && (
        <View style={styles.fieldWrap}>
          <View style={styles.labelRow}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>PIN numérico</Text>
            {accessPassword.trim().length > 0 ? (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: `${pinMeta.valid ? colors.successText : colors.dangerText}${colors.isDark ? '22' : '14'}`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: pinMeta.valid ? colors.successText : colors.dangerText },
                  ]}
                >
                  {pinMeta.label}
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.inputWrap,
              {
                borderColor: error ? colors.dangerText : colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Ionicons name="keypad-outline" size={18} color={colors.muted} />
            <TextInput
              value={accessPassword}
              onChangeText={updatePassword}
              editable={!disabled}
              placeholder="Ej: 1234 o 1234, 5678"
              placeholderTextColor={colors.muted}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'number-pad'}
              secureTextEntry={!showSecret}
              maxLength={MAX_REPAIR_ACCESS_LENGTH}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="PIN del equipo"
              style={[styles.input, styles.monoDigits, { color: colors.text }]}
            />
            {accessPassword.length > 0 ? (
              <Pressable
                onPress={() => updatePassword('')}
                hitSlop={8}
                style={styles.iconAction}
                accessibilityLabel="Borrar PIN"
              >
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setShowSecret((prev) => !prev)}
              hitSlop={8}
              style={styles.iconAction}
              accessibilityLabel={showSecret ? 'Ocultar PIN' : 'Mostrar PIN'}
            >
              <Ionicons name={showSecret ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.muted} />
            </Pressable>
          </View>

          <View style={styles.pinToolbar}>
            <Pressable
              onPress={appendSecondPin}
              disabled={disabled || !/\d/.test(accessPassword)}
              style={[
                styles.helperPill,
                {
                  borderColor: colors.accent,
                  backgroundColor: colors.accentSoft,
                  opacity: disabled || !/\d/.test(accessPassword) ? 0.45 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Agregar segundo PIN separado por coma"
            >
              <Ionicons name="add-circle-outline" size={14} color={colors.accent} />
              <Text style={[styles.helperPillText, { color: colors.accent }]}>Agregar 2.º PIN (SIM)</Text>
            </Pressable>
            <Text style={[styles.hintText, styles.flex, { color: colors.muted }]}>
              Separalos con coma si tiene pantalla y SIM.
            </Text>
          </View>
        </View>
      )}

      {accessType === 'password' && (
        <View style={styles.fieldWrap}>
          <View style={styles.labelRow}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Contraseña alfanumérica</Text>
            <Text
              style={[
                styles.counterText,
                {
                  color: accessPassword.length >= 90 ? colors.warningText : colors.muted,
                },
              ]}
            >
              {accessPassword.length}/{MAX_REPAIR_ACCESS_LENGTH}
            </Text>
          </View>

          <View
            style={[
              styles.inputWrap,
              {
                borderColor: error ? colors.dangerText : colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
            <TextInput
              value={accessPassword}
              onChangeText={updatePassword}
              editable={!disabled}
              placeholder="Ej: MiClave2026"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showSecret}
              maxLength={MAX_REPAIR_ACCESS_LENGTH}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Contraseña del equipo"
              style={[styles.input, { color: colors.text }]}
            />
            {accessPassword.length > 0 ? (
              <Pressable
                onPress={() => updatePassword('')}
                hitSlop={8}
                style={styles.iconAction}
                accessibilityLabel="Borrar contraseña"
              >
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setShowSecret((prev) => !prev)}
              hitSlop={8}
              style={styles.iconAction}
              accessibilityLabel={showSecret ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              <Ionicons name={showSecret ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={[styles.hintText, { color: colors.muted }]}>
            Respetá mayúsculas, minúsculas y símbolos tal como los ingresa el cliente.
          </Text>
        </View>
      )}

      {accessType === 'pattern' && (
        <PatternPicker
          value={accessPassword}
          onChange={updatePassword}
          error={error}
          onDrawingChange={onDrawingChange}
          disabled={disabled}
        />
      )}

      {accessType === 'other' && (
        <View style={styles.fieldWrap}>
          <View style={styles.labelRow}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Instrucción o código especial</Text>
            <Text
              style={[
                styles.counterText,
                {
                  color:
                    accessPassword.length >= MAX_REPAIR_ACCESS_LENGTH
                      ? colors.dangerText
                      : accessPassword.length >= 85
                        ? colors.warningText
                        : colors.muted,
                },
              ]}
            >
              {accessPassword.length}/{MAX_REPAIR_ACCESS_LENGTH}
            </Text>
          </View>

          <View
            style={[
              styles.inputWrap,
              styles.multilineWrap,
              {
                borderColor: error ? colors.dangerText : colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <TextInput
              value={accessPassword}
              onChangeText={updatePassword}
              editable={!disabled}
              placeholder="Ej: Clave en etiqueta de la batería o combinación física"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={MAX_REPAIR_ACCESS_LENGTH}
              accessibilityLabel="Método o nota de acceso"
              style={[styles.input, styles.multiline, { color: colors.text }]}
            />
            {accessPassword.length > 0 ? (
              <Pressable
                onPress={() => updatePassword('')}
                hitSlop={8}
                style={styles.clearMultiline}
                accessibilityLabel="Borrar nota de acceso"
              >
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.presetRow}>
            {OTHER_PRESETS.map((preset) => (
              <Pressable
                key={preset}
                onPress={() => applyOtherPreset(preset)}
                disabled={disabled}
                style={[styles.presetChip, { borderColor: colors.border, backgroundColor: colors.background }]}
              >
                <Text style={[styles.presetText, { color: colors.muted }]}>+ {preset}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 12 },
  typeGrid: { gap: 8 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  typeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  typeLabelSelected: {
    fontWeight: '800',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 17,
  },
  switchHintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  switchHintText: {
    fontSize: 12,
    fontWeight: '800',
  },
  fieldWrap: {
    gap: 7,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  multilineWrap: {
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  monoDigits: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  multiline: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  iconAction: {
    padding: 4,
  },
  clearMultiline: {
    paddingTop: 10,
    paddingLeft: 4,
  },
  pinToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  helperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  helperPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  hintText: {
    fontSize: 12,
    lineHeight: 16,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
