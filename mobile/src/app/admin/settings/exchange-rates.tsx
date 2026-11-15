import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { SettingsGate, SettingsOfflineNotice } from '@/components/settings/settings-gate';
import { Field, Notice, Section, StateView, WebsiteScreen, websiteStyles } from '@/components/website/website-ui';
import { usePalette } from '@/lib/palette';
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context';
import { deleteExchangeRate, fetchExchangeRates, saveExchangeRate, settingsErrorMessage } from '@/lib/settings-admin';
import {
  ROUNDINGS,
  addableCurrencies,
  convertSampleAmount,
  currencyName,
  describeRate,
  formatRateNumber,
  parseDecimal,
  rateIssue,
  type ExchangeRate,
  type ExchangeRatesState,
} from '@/lib/settings-model';

type Editing = { currency: string; rateText: string; rounding: number; isNew: boolean };

export default function ExchangeRatesScreen() {
  const scope = useSyncExternalStore(subscribePrivateCacheContext, getPrivateCacheContext);
  return (
    <SettingsGate title="Tipos de cambio">
      {() => <ExchangeRatesEditor key={scope.epoch} />}
    </SettingsGate>
  );
}

function ExchangeRatesEditor() {
  const colors = usePalette();
  const [state, setState] = useState<ExchangeRatesState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const requestSeq = useRef(0);

  const load = useCallback(async (showSpinner = false) => {
    const seq = ++requestSeq.current;
    const scope = getPrivateCacheContext();
    if (showSpinner) setRefreshing(true);
    try {
      const next = await fetchExchangeRates();
      if (seq !== requestSeq.current || scope.epoch !== getPrivateCacheContext().epoch) return;
      setState(next);
      setError(null);
    } catch (cause) {
      if (seq === requestSeq.current && scope.epoch === getPrivateCacheContext().epoch) {
        setError(settingsErrorMessage(cause, 'No pudimos cargar los tipos de cambio.'));
      }
    } finally {
      if (seq === requestSeq.current) setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
      return () => {
        requestSeq.current++;
      };
    }, [load]),
  );

  const reload = useCallback(() => {
    void load(true);
  }, [load]);

  if (!state) {
    return (
      <WebsiteScreen title="Tipos de cambio">
        {error ? (
          <StateView
            icon="alert-circle-outline"
            title="No pudimos cargar los tipos de cambio"
            text={error}
            action="Reintentar"
            onAction={() => void load(false)}
          />
        ) : (
          <StateView loading title="Cargando tipos de cambio…" />
        )}
      </WebsiteScreen>
    );
  }
  if (!state.available) {
    return (
      <WebsiteScreen title="Tipos de cambio" refreshing={refreshing} onRefresh={reload}>
        <StateView
          icon="construct-outline"
          title="Todavía no disponible"
          text="Tu comercio todavía no tiene activados los tipos de cambio. Consultá con soporte."
        />
      </WebsiteScreen>
    );
  }

  const local = state.localCurrency;
  const addable = addableCurrencies(state);
  const productsIn = (currency: string) => state.usage[currency] ?? 0;

  const persist = async (target: Editing, rate: number) => {
    const scope = getPrivateCacheContext();
    setBusy(true);
    try {
      const { productsUpdated } = await saveExchangeRate(target.currency, rate, target.rounding);
      if (scope.epoch !== getPrivateCacheContext().epoch) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setEditing(null);
      Alert.alert(
        'Tipo de cambio guardado',
        productsUpdated
          ? `Se recalculó el precio de ${productsUpdated} ${productsUpdated === 1 ? 'producto' : 'productos'} en ${target.currency}.`
          : `Ningún producto tiene el precio en ${target.currency} todavía.`,
      );
      void load(true);
    } catch (cause) {
      Alert.alert(
        'No pudimos guardar',
        settingsErrorMessage(cause, 'No pudimos guardar el tipo de cambio. Intentá nuevamente.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!editing || busy) return;
    const rate = parseDecimal(editing.rateText);
    const problem = rateIssue(rate);
    if (problem) {
      Alert.alert('Revisá el tipo de cambio', problem);
      return;
    }
    const affected = productsIn(editing.currency);
    if (affected === 0) {
      void persist(editing, rate);
      return;
    }
    // Cambia precios de venta: se confirma antes, diciendo cuántos productos toca.
    Alert.alert(
      'Se van a recalcular precios',
      `${affected} ${affected === 1 ? 'producto tiene' : 'productos tienen'} el precio en ${editing.currency}. Con ${describeRate({ currency: editing.currency, rate }, local)} su precio en ${local} se recalcula ahora.`,
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Guardar y recalcular', onPress: () => void persist(editing, rate) }],
    );
  };

  const remove = (rate: ExchangeRate) => {
    const affected = productsIn(rate.currency);
    if (affected > 0) {
      Alert.alert(
        'No se puede quitar',
        `${affected} ${affected === 1 ? 'producto tiene' : 'productos tienen'} el precio en ${rate.currency}. Cambialos a ${local} antes de quitar la moneda.`,
      );
      return;
    }
    Alert.alert(
      `¿Quitar ${rate.currency}?`,
      'Ya no vas a poder cargar precios en esta moneda hasta volver a agregarla.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            const scope = getPrivateCacheContext();
            try {
              await deleteExchangeRate(rate.currency);
              if (scope.epoch === getPrivateCacheContext().epoch) void load(true);
            } catch (cause) {
              Alert.alert('No pudimos quitarla', settingsErrorMessage(cause, 'Intentá nuevamente.'));
            }
          },
        },
      ],
    );
  };

  const preview = editing ? parseDecimal(editing.rateText) : Number.NaN;
  const previewValid = Boolean(editing && Number.isFinite(preview) && !rateIssue(preview));
  const sampleAmount = editing && (editing.currency === 'PYG' || editing.currency === 'CLP' || (Number.isFinite(preview) && preview < 0.05))
    ? 100000
    : 100;

  return (
    <WebsiteScreen
      title="Tipos de cambio"
      subtitle={`Moneda del comercio: ${local}`}
      refreshing={refreshing}
      onRefresh={reload}
    >
      <SettingsOfflineNotice />
      {error ? (
        <Notice
          tone="danger"
          text={error}
          actionLabel="Reintentar"
          onAction={reload}
        />
      ) : null}
      <Notice
        text={`Si cargás el precio de un producto en otra moneda (por ejemplo USD), su precio en ${local} se calcula con este tipo de cambio. Al cambiarlo se recalculan esos productos.`}
      />
      {!state.canEdit ? (
        <Notice tone="warning" text="Solo el dueño o un administrador pueden cambiar los tipos de cambio." />
      ) : null}

      <Section title="Monedas cargadas" icon="swap-horizontal-outline">
        {state.rates.length === 0 ? (
          <Text style={[styles.muted, { color: colors.muted }]}>Todavía no cargaste ninguna moneda.</Text>
        ) : (
          state.rates.map((rate) => {
            const count = productsIn(rate.currency);
            return (
              <View key={rate.currency} style={[styles.row, { borderColor: colors.border }]}>
                <View style={styles.flex}>
                  <Text style={[styles.title, { color: colors.text }]}>{describeRate(rate, local)}</Text>
                  <Text style={[styles.muted, { color: colors.muted }]}>
                    {currencyName(rate.currency)} · {count} {count === 1 ? 'producto' : 'productos'} · {ROUNDINGS.find((item) => item.value === rate.rounding)?.label ?? `Redondeo ${rate.rounding}`}
                  </Text>
                </View>
                {state.canEdit ? (
                  <>
                    <Pressable
                      onPress={() =>
                        setEditing({
                          currency: rate.currency,
                          rateText: formatRateNumber(rate.rate),
                          rounding: rate.rounding,
                          isNew: false,
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${rate.currency}`}
                      hitSlop={8}
                      style={styles.icon}
                    >
                      <Ionicons name="create-outline" size={20} color={colors.accent} />
                    </Pressable>
                    <Pressable
                      onPress={() => remove(rate)}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar ${rate.currency}`}
                      hitSlop={8}
                      style={styles.icon}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.dangerText} />
                    </Pressable>
                  </>
                ) : null}
              </View>
            );
          })
        )}
        {state.canEdit && addable.length ? (
          <Pressable
            onPress={() => setEditing({ currency: addable[0], rateText: '', rounding: 1, isNew: true })}
            accessibilityRole="button"
            style={[websiteStyles.secondaryButton, { borderColor: colors.border }]}
          >
            <Ionicons name="add" size={18} color={colors.text} />
            <Text style={[websiteStyles.secondaryText, { color: colors.text }]}>Agregar moneda</Text>
          </Pressable>
        ) : null}
      </Section>

      {state.history.length ? (
        <Section title="Últimos cambios" icon="time-outline">
          {state.history.slice(0, 8).map((item) => (
            <View key={item.id} style={[styles.row, { borderColor: colors.border }]}>
              <View style={styles.flex}>
                <Text style={[styles.text, { color: colors.text }]}>
                  {item.currency}: {item.previous_rate === null ? 'nuevo' : formatRateNumber(Number(item.previous_rate))} → {formatRateNumber(Number(item.rate))}
                </Text>
                <Text style={[styles.muted, { color: colors.muted }]}>
                  {new Date(item.created_at).toLocaleDateString('es-PY')} · {item.products_updated} {item.products_updated === 1 ? 'producto recalculado' : 'productos recalculados'}
                </Text>
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      <BottomSheet
        visible={editing !== null}
        title={editing?.isNew ? 'Agregar moneda' : `Tipo de cambio ${editing?.currency ?? ''}`}
        subtitle={`Cuántos ${local} vale 1 unidad de la otra moneda`}
        onClose={() => (busy ? undefined : setEditing(null))}
        footer={
          <Pressable
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
            style={[websiteStyles.primaryButton, busy && styles.disabled]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={websiteStyles.primaryText}>Guardar</Text>}
          </Pressable>
        }
      >
        {editing ? (
          <View style={styles.sheet}>
            {editing.isNew ? (
              <View style={styles.chips}>
                {addable.map((code) => (
                  <Chip
                    key={code}
                    label={code}
                    selected={editing.currency === code}
                    onPress={() => setEditing({ ...editing, currency: code })}
                  />
                ))}
              </View>
            ) : null}
            <Field
              label={`1 ${editing.currency} =`}
              value={editing.rateText}
              onChangeText={(rateText) => setEditing({ ...editing, rateText })}
              placeholder={local === 'PYG' ? '7.300' : '0,000137'}
              keyboardType="decimal-pad"
              maxLength={16}
              error={editing.rateText && rateIssue(preview) ? rateIssue(preview) ?? undefined : undefined}
              help={
                previewValid
                  ? describeRate({ currency: editing.currency, rate: preview }, local)
                  : 'Escribilo como en el banco, por ejemplo 7.300 o 7.300,50.'
              }
            />
            <Text style={[styles.label, { color: colors.text }]}>Redondeo del precio en {local}</Text>
            <View style={styles.chips}>
              {ROUNDINGS.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  selected={editing.rounding === item.value}
                  onPress={() => setEditing({ ...editing, rounding: item.value })}
                />
              ))}
            </View>
            {previewValid ? (
              <View style={[styles.previewBox, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
                <Text style={[styles.previewLabel, { color: colors.muted }]}>Ejemplo con redondeo</Text>
                <Text style={[styles.previewValue, { color: colors.text }]}>
                  {editing.currency} {formatRateNumber(sampleAmount)} → {convertSampleAmount(sampleAmount, preview, editing.rounding, local)}
                </Text>
              </View>
            ) : null}
            {productsIn(editing.currency) ? (
              <Notice
                tone="warning"
                text={`Al guardar se recalcula el precio de ${productsIn(editing.currency)} ${productsIn(editing.currency) === 1 ? 'producto' : 'productos'} en ${editing.currency}.`}
              />
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
    </WebsiteScreen>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        websiteStyles.chip,
        {
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.accentSoft : 'transparent',
        },
      ]}
    >
      <Text style={[websiteStyles.chipText, { color: selected ? colors.accent : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  title: { fontSize: 15, fontWeight: '800' },
  text: { fontSize: 14, fontWeight: '600' },
  muted: { fontSize: 12 },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheet: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 13, fontWeight: '700' },
  previewBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  previewLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  previewValue: { fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
