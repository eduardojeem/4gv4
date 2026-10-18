import { Slot } from 'expo-router';

import { SaasShell } from '@/components/saas/shell';
import { SaasProvider } from '@/lib/saas';

export default function SaasLayout() {
  return <SaasProvider><SaasShell><Slot /></SaasShell></SaasProvider>;
}
