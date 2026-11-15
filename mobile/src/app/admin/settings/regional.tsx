import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { SettingsGate, SettingsOfflineNotice } from '@/components/settings/settings-gate';
import {
  Field,
  Notice,
  SaveBar,
  Section,
  StatusPill,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
  websiteStyles,
} from '@/components/website/website-ui';
import { usePalette } from '@/lib/palette';
import {
  needsCurrencyConfirmation,
  saveOrgSettings,
  settingsErrorMessage,
} from '@/lib/settings-admin';
import { useSettings } from '@/lib/settings-context';
import {
  CURRENCIES,
  LANGUAGES,
  TIME_ZONES,
  changedSettings,
  currencyName,
  formatNumber,
  formatPricePreview,
  parseDecimal,
  settingsIssues,
  timeZoneName,
  type OrgSettings,
} from '@/lib/settings-model';
import {
  getSupportedRegionalCountries,
  normalizeCountryCode,
  normalizeLocaleCode,
} from '../../../../../src/lib/regional/contract';
import {
  countryLabel,
  localeForRegion,
  regionalSuggestion,
} from '../../../../../src/lib/regional/country-labels';

export default function RegionalSettingsScreen() {
  return (
    <SettingsGate title="País, impuestos y moneda">
      {(settings) => <RegionalEditor saved={settings} />}
    </SettingsGate>
  );
}

function RegionalEditor({ saved }: { saved: OrgSettings }) {
  const colors = usePalette();
  const { applySaved, setupStatus, refreshing, reload } = useSettings();
  const [patch, setPatch] = useState<Partial<OrgSettings>>({});
  // El IVA se escribe como texto («10,5») y se convierte al guardar.
  const [taxText, setTaxText] = useState<string | null>(null);
  const [confirmCurrency, setConfirmCurrency] = useState(false);
  const [saving, setSaving] = useState(false);

  const draft = useMemo<OrgSettings>(
    () => ({
      ...saved,
      ...patch,
      taxRate: taxText === null ? saved.taxRate : parseDecimal(taxText),
    }),
    [saved, patch, taxText],
  );
  const changes = useMemo(() => changedSettings(saved, draft), [saved, draft]);
  const dirty = Object.keys(changes).length > 0;
  const issues = settingsIssues(draft);
  const currencyChanged = draft.currency !== saved.currency;
  const currencyChangeIsHarmless = currencyChanged && setupStatus?.hasBusinessData === false;

  const set = (next: Partial<OrgSettings>) =>
    setPatch((current) => ({ ...current, ...next }));

  const discard = useCallback(() => {
    setPatch({});
    setTaxText(null);
    setConfirmCurrency(false);
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);

  const onCountryChange = (value: string) => {
    const country = normalizeCountryCode(value);
    if (!country) return;
    const newLocale = normalizeLocaleCode(localeForRegion(draft.language, country));
    set({
      countryCode: country,
      locale: newLocale,
    });
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const onLanguageChange = (language: string) => {
    const newLocale = draft.countryCode
      ? normalizeLocaleCode(localeForRegion(language, draft.countryCode))
      : draft.locale;
    set({ language, locale: newLocale });
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const suggestion = regionalSuggestion(draft.countryCode);
  const suggestionDiffers = Boolean(
    suggestion &&
      ((suggestion.currency && suggestion.currency !== draft.currency) ||
        (suggestion.timeZone && suggestion.timeZone !== draft.timeZone) ||
        (suggestion.language && suggestion.language !== draft.language)),
  );

  const applyRegionalSuggestion = () => {
    if (!suggestion) return;
    const nextCurrency = suggestion.currency ?? draft.currency;
    const nextLanguage = suggestion.language ?? draft.language;
    const nextLocale = draft.countryCode
      ? normalizeLocaleCode(localeForRegion(nextLanguage, draft.countryCode))
      : draft.locale;
    set({
      currency: nextCurrency,
      timeZone: suggestion.timeZone ?? draft.timeZone,
      language: nextLanguage,
      locale: nextLocale,
    });
    if (nextCurrency !== draft.currency) setConfirmCurrency(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
  };

  const timeZoneOptions = useMemo(() => {
    const list = TIME_ZONES.map((item) => ({ value: item.code, label: item.name }));
    if (saved.timeZone && !list.some((item) => item.value === saved.timeZone)) {
      list.unshift({ value: saved.timeZone, label: timeZoneName(saved.timeZone) });
    }
    return list;
  }, [saved.timeZone]);

  const pricePreview = useMemo(
    () =>
      formatPricePreview({
        currency: draft.currency,
        language: draft.language,
        countryCode: draft.countryCode,
        locale: draft.locale,
      }),
    [draft.currency, draft.language, draft.countryCode, draft.locale],
  );

  const save = useCallback(async () => {
    if (issues.taxRate || issues.timeZone) {
      Alert.alert(
        'Revisá los datos',
        [issues.taxRate, issues.timeZone].filter(Boolean).join('\n'),
      );
      return false;
    }
    if (currencyChanged && !currencyChangeIsHarmless && !confirmCurrency) {
      Alert.alert(
        'Confirmá el cambio de moneda',
        'Marcá la confirmación de abajo: cambiar la moneda no convierte precios, saldos ni operaciones ya cargadas.',
      );
      return false;
    }
    setSaving(true);
    try {
      const confirmed = currencyChanged && (currencyChangeIsHarmless || confirmCurrency);
      const result = await saveOrgSettings(changes, confirmed);
      applySaved(result ?? draft);
      setPatch({});
      setTaxText(null);
      setConfirmCurrency(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
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
  }, [
    issues,
    currencyChanged,
    currencyChangeIsHarmless,
    confirmCurrency,
    changes,
    draft,
    applySaved,
  ]);

  useUnsavedChangesGuard(dirty, save, saving);

  return (
    <WebsiteScreen
      title="País, impuestos y moneda"
      subtitle="Cómo se cobra y se registra"
      saving={saving}
      refreshing={!dirty ? refreshing : undefined}
      onRefresh={!dirty ? () => void reload() : undefined}
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={discard}
        />
      }
    >
      <SettingsOfflineNotice />

      <Section
        title="País del negocio"
        icon="globe-outline"
        hint={
          saved.needsCountryConfirmation && !draft.countryCode
            ? 'Todavía no confirmaste el país. Elegilo para sugerir moneda, formato y zona horaria; no cambia nada de lo que ya cargaste.'
            : 'Define lo que te sugerimos para moneda, formato y zona horaria. Cambiarlo no convierte precios ni modifica ventas.'
        }
      >
        {saved.needsCountryConfirmation && !draft.countryCode ? (
          <Notice
            tone="warning"
            text="Confirmá el país de tu negocio para que el sistema ajuste formatos y sugerencias regionales. Esto no altera precios ni ventas ya registradas."
          />
        ) : null}
        <ChipGroup
          options={getSupportedRegionalCountries().map(({ code, label }) => ({
            value: code,
            label,
          }))}
          value={draft.countryCode ?? ''}
          onChange={onCountryChange}
        />
        <Text style={[styles.selected, { color: colors.accent }]}>
          {draft.countryCode ? countryLabel(draft.countryCode) : 'Sin país confirmado'}
        </Text>

        {suggestion && suggestionDiffers ? (
          <View
            style={[
              styles.suggestionCard,
              { borderColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            <View style={styles.suggestionHeader}>
              <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
              <Text style={[styles.suggestionText, { color: colors.text }]}>
                En {countryLabel(draft.countryCode)} lo habitual es {suggestion.currency}
                {suggestion.timeZone ? ` y ${timeZoneName(suggestion.timeZone)}` : ''}.
              </Text>
            </View>
            <Pressable
              onPress={applyRegionalSuggestion}
              accessibilityRole="button"
              accessibilityLabel="Aplicar sugerencias habituales"
              style={[
                styles.suggestionButton,
                { borderColor: colors.accent, backgroundColor: colors.accentSoft },
              ]}
            >
              <Text style={[styles.suggestionButtonText, { color: colors.accent }]}>
                Aplicar sugerencias habituales
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Section>

      <Section
        title="Moneda del comercio"
        icon="cash-outline"
        hint="En la que se cargan los precios y se cobran las ventas."
      >
        <ChipGroup
          options={CURRENCIES.map((item) => ({
            value: item.code,
            label: item.code,
            hint: item.name,
          }))}
          value={draft.currency}
          onChange={(currency) => {
            set({ currency });
            setConfirmCurrency(false);
          }}
        />
        <Text style={[styles.selected, { color: colors.accent }]}>
          {currencyName(draft.currency)}
        </Text>
        {currencyChanged ? (
          currencyChangeIsHarmless ? (
            <Notice
              tone="info"
              text={`Vas a cambiar de ${saved.currency} a ${draft.currency}. Como todavía no cargaste productos ni ventas, no hay importes que se vean afectados.`}
            />
          ) : (
            <>
              <Notice
                tone="warning"
                text={`Cambiar de ${saved.currency} a ${draft.currency} no convierte precios, deudas ni registros anteriores: los montos guardados se van a mostrar con la nueva moneda.`}
              />
              <ToggleRow
                label="Entiendo y confirmo el cambio de moneda"
                hint="Sin esta confirmación no se guarda."
                value={confirmCurrency}
                onValueChange={setConfirmCurrency}
              />
            </>
          )
        ) : null}
      </Section>

      <Section title="IVA" icon="receipt-outline">
        <Field
          label="IVA por defecto (%)"
          value={taxText ?? formatNumber(saved.taxRate, 2)}
          onChangeText={setTaxText}
          placeholder="10"
          keyboardType="decimal-pad"
          maxLength={6}
          error={taxText !== null ? issues.taxRate : undefined}
          help="Se aplica a las ventas y presupuestos nuevos; no cambia lo ya emitido. Es una sola tasa: todavía no se combinan 10 % y 5 % en una misma venta."
        />
      </Section>

      <Section
        title="Zona horaria"
        icon="time-outline"
        hint="Determina la fecha de los cierres diarios de caja, reportes y métricas."
      >
        <ChipGroup
          options={timeZoneOptions}
          value={draft.timeZone}
          onChange={(timeZone) => set({ timeZone })}
        />
      </Section>

      <Section
        title="Formato regional"
        icon="language-outline"
        hint="Cómo se ven los números y las fechas (separadores de miles y decimales). Los textos siguen en español."
      >
        <ChipGroup
          options={LANGUAGES.map((item) => ({
            value: item.code,
            label: `${item.name} (${item.locale})`,
          }))}
          value={draft.language}
          onChange={onLanguageChange}
        />
        <View
          style={[
            styles.previewBox,
            { backgroundColor: colors.accentSoft, borderColor: colors.border },
          ]}
        >
          <View style={styles.flex}>
            <Text style={[styles.previewCaption, { color: colors.muted }]}>
              Así se ve un precio
            </Text>
            <Text style={[styles.previewValue, { color: colors.text }]}>
              {pricePreview}
            </Text>
          </View>
          <StatusPill label={draft.currency} tone="primary" />
        </View>
      </Section>
    </WebsiteScreen>
  );
}

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; hint?: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const colors = usePalette();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.hint ? `${option.label}, ${option.hint}` : option.label}
            style={[
              websiteStyles.chip,
              {
                borderColor: selected ? colors.accent : colors.border,
                backgroundColor: selected ? colors.accentSoft : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                websiteStyles.chipText,
                { color: selected ? colors.accent : colors.text },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selected: { fontSize: 12, fontWeight: '700' },
  suggestionCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10, marginTop: 6 },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestionText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  suggestionButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  suggestionButtonText: { fontSize: 12, fontWeight: '700' },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2,
  },
  previewCaption: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  previewValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },
});
