import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { BiometricSettingCard } from '@/components/settings/biometric-setting';
import { SettingsGate, SettingsOfflineNotice } from '@/components/settings/settings-gate';
import { Notice, SettingsCard, WebsiteScreen } from '@/components/website/website-ui';
import { usePalette } from '@/lib/palette';
import { useSettings } from '@/lib/settings-context';
import { formatNumber, timeZoneName } from '@/lib/settings-model';
import { countryLabel } from '../../../../../src/lib/regional/country-labels';

const go = (path: string) => router.push(`/admin/settings/${path}` as never);

export default function SettingsHome() {
  const colors = usePalette();
  const { refreshing, reload, organizationName } = useSettings();

  return (
    <SettingsGate title="Configuración">
      {(settings) => {
        const identity = [settings.companyName, settings.companyRuc && `RUC ${settings.companyRuc}`].filter(Boolean).join(' · ');
        const countryPart = settings.countryCode ? countryLabel(settings.countryCode) : null;
        const regional = [countryPart, `${settings.currency} · IVA ${formatNumber(settings.taxRate, 2)} %`].filter(Boolean).join(' · ');
        return (
          <WebsiteScreen title="Configuración" subtitle={organizationName ?? undefined} refreshing={refreshing} onRefresh={() => void reload()}>
            <SettingsOfflineNotice />
            <Notice text="Es la misma configuración que editás desde la web: los cambios se aplican apenas los guardás." />
            <SettingsCard icon="business-outline" title="Datos de la empresa" hint={identity || 'Nombre, RUC y contacto'} onPress={() => go('company')} />
            <SettingsCard icon="cash-outline" title="País, impuestos y moneda" hint={regional} badge={settings.needsCountryConfirmation ? 'Confirmar país' : undefined} onPress={() => go('regional')} />
            <SettingsCard icon="swap-horizontal-outline" title="Tipos de cambio" hint="Precios cargados en otra moneda" onPress={() => go('exchange-rates')} />
            <SettingsCard icon="briefcase-outline" title="Perfil del negocio" hint="Rubro, forma de trabajo y herramientas" onPress={() => go('profile')} />
            <SettingsCard icon="globe-outline" title="Sitio web" hint="Tienda online, logo, banners y publicación" onPress={() => router.push('/admin/website' as never)} />
            <Text style={[styles.group, { color: colors.muted }]}>Este teléfono</Text>
            <BiometricSettingCard />
            <Text style={[styles.foot, { color: colors.muted }]}>El tema y el color del panel web se eligen en cada navegador; la app sigue el modo claro u oscuro del teléfono.</Text>
          </WebsiteScreen>
        );
      }}
    </SettingsGate>
  );
}

const styles = StyleSheet.create({
  foot: { fontSize: 12, textAlign: 'center' },
  group: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
});
