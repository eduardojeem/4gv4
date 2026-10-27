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
import { normalizeCountryCode } from '../../../../../src/lib/regional/contract';

export default function RegionalSettingsScreen() {
  return <SettingsGate title="Moneda e impuestos">{(settings) => <RegionalEditor saved={settings} />}</SettingsGate>;
}

function RegionalEditor({ saved }: { saved: OrgSettings }) {
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
    <WebsiteScreen title="Moneda e impuestos" subtitle="Cómo se cobra y se registra" footer={<SaveBar dirty={dirty} saving={saving} onSave={() => void save()} />}>
      <SettingsOfflineNotice />

      {saved.needsCountryConfirmation ? <Section title="País del negocio" icon="globe-outline" hint="Es una confirmación opcional para organizaciones creadas antes de guardar la región. No cambia precios ni datos existentes.">
        <ChipGroup options={[{ value: 'PY', label: 'Paraguay' }, { value: 'BR', label: 'Brasil' }, { value: 'AR', label: 'Argentina' }, { value: 'US', label: 'Estados Unidos' }]} value={draft.countryCode ?? ''} onChange={(value) => set({ countryCode: normalizeCountryCode(value) })} />
      </Section> : null}

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
});
