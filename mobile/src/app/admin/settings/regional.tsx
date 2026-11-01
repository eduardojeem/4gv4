import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { SettingsGate, SettingsOfflineNotice } from '@/components/settings/settings-gate';
import { Field, Notice, SaveBar, Section, ToggleRow, WebsiteScreen, useUnsavedChangesGuard, websiteStyles } from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import { needsCurrencyConfirmation, saveOrgSettings, settingsErrorMessage } from '@/lib/settings-admin';
import { useSettings } from '@/lib/settings-context';
import {
  CURRENCIES,
  LANGUAGES,
  TIME_ZONES,
  changedSettings,
  currencyName,
  formatNumber,
  parseDecimal,
  settingsIssues,
  type OrgSettings,
} from '@/lib/settings-model';
import { getSupportedRegionalCountries, normalizeCountryCode, normalizeLocaleCode } from '../../../../../src/lib/regional/contract';
import { countryLabel, localeForRegion, regionalSuggestion } from '../../../../../src/lib/regional/country-labels';

export default function RegionalSettingsScreen() {
  return <SettingsGate title="País, impuestos y moneda">{(settings) => <RegionalEditor saved={settings} />}</SettingsGate>;
}

function RegionalEditor({ saved }: { saved: OrgSettings }) {
  const colors = usePalette();
  const { applySaved } = useSettings();
  const [patch, setPatch] = useState<Partial<OrgSettings>>({});
  // El IVA se escribe como texto («10,5») y se convierte al guardar.
  const [taxText, setTaxText] = useState<string | null>(null);
  const [confirmCurrency, setConfirmCurrency] = useState(false);
  const [saving, setSaving] = useState(false);
  const draft = useMemo<OrgSettings>(() => ({ ...saved, ...patch, taxRate: taxText === null ? saved.taxRate : parseDecimal(taxText) }), [saved, patch, taxText]);
  const changes = useMemo(() => changedSettings(saved, draft), [saved, draft]);
  const dirty = Object.keys(changes).length > 0;
  const issues = settingsIssues(draft);
  const currencyChanged = draft.currency !== saved.currency;
  const set = (next: Partial<OrgSettings>) => setPatch((current) => ({ ...current, ...next }));

  const onCountryChange = (value: string) => {
    const country = normalizeCountryCode(value);
    if (!country) return;
    const newLocale = normalizeLocaleCode(localeForRegion(draft.language, country));
    set({
      countryCode: country,
      locale: newLocale,
    });
    void Haptics.selectionAsync();
  };

  const suggestion = regionalSuggestion(draft.countryCode);
  const suggestionDiffers = Boolean(
    suggestion && (
      (suggestion.currency && suggestion.currency !== draft.currency)
      || (suggestion.timeZone && suggestion.timeZone !== draft.timeZone)
    )
  );

  const applyRegionalSuggestion = () => {
    if (!suggestion) return;
    set({
      currency: suggestion.currency ?? draft.currency,
      timeZone: suggestion.timeZone ?? draft.timeZone,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const save = useCallback(async () => {
    if (issues.taxRate || issues.timeZone) {
      Alert.alert('Revisá los datos', [issues.taxRate, issues.timeZone].filter(Boolean).join('\n'));
      return false;
    }
    if (currencyChanged && !confirmCurrency) {
      Alert.alert('Confirmá el cambio de moneda', 'Marcá la confirmación de abajo: cambiar la moneda no convierte precios, saldos ni operaciones ya cargadas.');
      return false;
    }
    setSaving(true);
    try {
      const result = await saveOrgSettings(changes, currencyChanged && confirmCurrency);
      applySaved(result ?? draft);
      setPatch({});
      setTaxText(null);
      setConfirmCurrency(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        needsCurrencyConfirmation(error)
          ? 'Confirmá que el cambio de moneda no convierte precios, saldos ni operaciones existentes.'
          : settingsErrorMessage(error, 'No pudimos guardar los cambios. Intentá nuevamente.'),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [issues, currencyChanged, confirmCurrency, changes, draft, applySaved]);

  useUnsavedChangesGuard(dirty && !saving, save);

  return (
    <WebsiteScreen title="País, impuestos y moneda" subtitle="Cómo se cobra y se registra" footer={<SaveBar dirty={dirty} saving={saving} onSave={() => void save()} />}>
      <SettingsOfflineNotice />

      <Section
        title="País del negocio"
        icon="globe-outline"
        hint={
          saved.needsCountryConfirmation && !draft.countryCode
            ? 'Todavía no confirmaste el país. Elegilo para sugerir moneda, formato y zona horaria; no cambia nada de lo que ya cargaste.'
            : 'Define lo que te sugerimos para moneda, formato y zona horaria. Cambiarlo no convierte precios ni modifica ventas.'
        }>
        {saved.needsCountryConfirmation && !draft.countryCode ? (
          <Notice
            tone="warning"
            text="Confirmá el país de tu negocio para que el sistema ajuste formatos y sugerencias regionales. Esto no altera precios ni ventas ya registradas."
          />
        ) : null}
        <ChipGroup
          options={getSupportedRegionalCountries().map(({ code, label }) => ({ value: code, label }))}
          value={draft.countryCode ?? ''}
          onChange={onCountryChange}
        />
        <Text style={styles.selected}>
          {draft.countryCode ? countryLabel(draft.countryCode) : 'Sin país confirmado'}
        </Text>

        {suggestion && suggestionDiffers ? (
          <View style={[styles.suggestionCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.suggestionHeader}>
              <Ionicons name="sparkles-outline" size={16} color={palette.primary} />
              <Text style={[styles.suggestionText, { color: colors.text }]}>
                En {countryLabel(draft.countryCode)} lo habitual es {suggestion.currency}
                {suggestion.timeZone ? ` y la hora de ${suggestion.timeZone.replace('America/', '').replace('_', ' ')}` : ''}.
              </Text>
            </View>
            <Pressable
              onPress={applyRegionalSuggestion}
              accessibilityRole="button"
              accessibilityLabel="Aplicar sugerencias habituales"
              style={[styles.suggestionButton, { borderColor: palette.primary }]}>
              <Text style={[styles.suggestionButtonText, { color: palette.primary }]}>
                Aplicar sugerencias habituales
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Section>

      <Section title="Moneda del comercio" icon="cash-outline" hint="En la que se cargan los precios y se cobran las ventas.">
        <ChipGroup options={CURRENCIES.map((item) => ({ value: item.code, label: item.code, hint: item.name }))} value={draft.currency} onChange={(currency) => {
          set({ currency });
          setConfirmCurrency(false);
        }} />
        <Text style={styles.selected}>{currencyName(draft.currency)}</Text>
        {currencyChanged ? (
          <>
            <Notice tone="warning" text={`Cambiar de ${saved.currency} a ${draft.currency} no convierte precios, deudas ni registros anteriores: los montos guardados se van a mostrar con la nueva moneda.`} />
            <ToggleRow label="Entiendo y confirmo el cambio de moneda" hint="Sin esta confirmación no se guarda." value={confirmCurrency} onValueChange={setConfirmCurrency} />
          </>
        ) : null}
      </Section>

      <Section title="IVA" icon="receipt-outline">
        <Field label="IVA por defecto (%)" value={taxText ?? formatNumber(saved.taxRate, 2)} onChangeText={setTaxText} placeholder="10" keyboardType="decimal-pad" maxLength={6} error={taxText !== null ? issues.taxRate : undefined} help="Se aplica a las ventas y presupuestos nuevos; no cambia lo ya emitido. Es una sola tasa: todavía no se combinan 10 % y 5 % en una misma venta." />
      </Section>

      <Section title="Zona horaria" icon="time-outline" hint="Determina la fecha de los cierres diarios de caja, reportes y métricas.">
        <ChipGroup options={TIME_ZONES.map((item) => ({ value: item.code, label: item.name }))} value={draft.timeZone} onChange={(timeZone) => set({ timeZone })} />
      </Section>

      <Section title="Formato regional" icon="language-outline" hint="Cómo se ven los números y las fechas (separadores de miles y decimales). Los textos siguen en español.">
        <ChipGroup options={LANGUAGES.map((item) => ({ value: item.code, label: `${item.name} (${item.locale})` }))} value={draft.language} onChange={(language) => set({ language })} />
      </Section>
    </WebsiteScreen>
  );
}

function ChipGroup({ options, value, onChange }: { options: { value: string; label: string; hint?: string }[]; value: string; onChange: (value: string) => void }) {
  const colors = usePalette();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={option.hint ? `${option.label}, ${option.hint}` : option.label}
            style={[websiteStyles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? `${palette.primary}12` : 'transparent' }]}>
            <Text style={[websiteStyles.chipText, { color: selected ? palette.primary : colors.text }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selected: { fontSize: 12, color: palette.primary, fontWeight: '700' },
  suggestionCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10, marginTop: 6 },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestionText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  suggestionButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  suggestionButtonText: { fontSize: 12, fontWeight: '700' },
});
