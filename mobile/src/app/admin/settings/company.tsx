import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { SettingsGate, SettingsOfflineNotice } from '@/components/settings/settings-gate';
import {
  Field,
  Notice,
  SaveBar,
  Section,
  WebsiteScreen,
  useUnsavedChangesGuard,
} from '@/components/website/website-ui';
import { saveOrgSettings, settingsErrorMessage } from '@/lib/settings-admin';
import { useSettings } from '@/lib/settings-context';
import {
  changedSettings,
  fiscalIdLabel,
  fiscalIdPlaceholder,
  settingsIssues,
  type OrgSettings,
} from '@/lib/settings-model';

export default function CompanySettingsScreen() {
  return (
    <SettingsGate title="Datos de la empresa">
      {(settings) => <CompanyEditor saved={settings} />}
    </SettingsGate>
  );
}

function CompanyEditor({ saved }: { saved: OrgSettings }) {
  const { applySaved, refreshing, reload } = useSettings();
  const [patch, setPatch] = useState<Partial<OrgSettings>>({});
  const [saving, setSaving] = useState(false);

  const draft = useMemo(() => ({ ...saved, ...patch }), [saved, patch]);
  const changes = useMemo(() => changedSettings(saved, draft), [saved, draft]);
  const dirty = Object.keys(changes).length > 0;
  const issues = settingsIssues(draft);
  const set = (next: Partial<OrgSettings>) => setPatch((current) => ({ ...current, ...next }));

  const discard = useCallback(() => {
    setPatch({});
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);

  const save = useCallback(async () => {
    const problems = [
      issues.companyName,
      issues.companyRuc,
      issues.companyEmail,
      issues.companyPhone,
      issues.companyAddress,
      issues.city,
    ].filter(Boolean);
    if (problems.length) {
      Alert.alert('Revisá los datos', problems.join('\n'));
      return false;
    }
    setSaving(true);
    try {
      const result = await saveOrgSettings(changes);
      applySaved(result ?? {
        ...draft,
        companyName: draft.companyName.trim(),
        companyRuc: draft.companyRuc.trim(),
        companyEmail: draft.companyEmail.trim(),
        companyPhone: draft.companyPhone.trim(),
        companyAddress: draft.companyAddress.trim(),
        city: draft.city.trim(),
      });
      setPatch({});
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        settingsErrorMessage(error, 'No pudimos guardar los cambios. Intentá nuevamente.'),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [issues, changes, draft, applySaved]);

  useUnsavedChangesGuard(dirty, save, saving);

  const taxIdLabel = fiscalIdLabel(saved.countryCode);
  const taxIdPlaceholder = fiscalIdPlaceholder(saved.countryCode);

  return (
    <WebsiteScreen
      title="Datos de la empresa"
      subtitle="Tickets, comprobantes y panel"
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
      <Notice text="Estos datos salen en los tickets, comprobantes y el panel, y sincronizan la sucursal principal. Para WhatsApp, horarios, mapa y redes usá Sitio web → Negocio, horario y mapa." />

      <Section title="Identidad" icon="business-outline">
        <Field
          label="Nombre del comercio"
          value={draft.companyName}
          onChangeText={(value) => set({ companyName: value })}
          placeholder="Mi Tienda"
          maxLength={100}
          showCount
          error={issues.companyName}
        />
        <Field
          label={taxIdLabel}
          value={draft.companyRuc}
          onChangeText={(value) => set({ companyRuc: value })}
          placeholder={taxIdPlaceholder}
          autoCapitalize="none"
          maxLength={50}
          error={issues.companyRuc}
          help="Si todavía no tenés, dejalo vacío."
        />
      </Section>

      <Section title="Contacto" icon="call-outline">
        <Field
          label="Email"
          value={draft.companyEmail}
          onChangeText={(value) => set({ companyEmail: value })}
          placeholder="contacto@tucomercio.com"
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={100}
          error={issues.companyEmail}
          help="Opcional. Aparece en comprobantes y tienda."
        />
        <Field
          label="Teléfono"
          value={draft.companyPhone}
          onChangeText={(value) => set({ companyPhone: value })}
          placeholder="0981 123 456"
          keyboardType="phone-pad"
          maxLength={50}
          error={issues.companyPhone}
        />
      </Section>

      <Section title="Ubicación" icon="location-outline">
        <Field
          label="Dirección"
          value={draft.companyAddress}
          onChangeText={(value) => set({ companyAddress: value })}
          placeholder="Calle y número"
          maxLength={500}
          showCount
          multiline
          error={issues.companyAddress}
        />
        <Field
          label="Ciudad"
          value={draft.city}
          onChangeText={(value) => set({ city: value })}
          placeholder="Asunción"
          maxLength={100}
          error={issues.city}
        />
      </Section>
    </WebsiteScreen>
  );
}
