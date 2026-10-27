/**
 * «Primeros pasos» de un comercio nuevo: los mismos pasos que /admin/onboarding
 * en la web, cada uno con su pantalla en la app. Lógica pura para probarla.
 */

export type OnboardingStepKey = 'hasCompanyInfo' | 'hasProducts' | 'hasAgenda' | 'hasPublicStore' | 'hasTeam';

export type OnboardingProgress = {
  steps: Record<OnboardingStepKey, boolean>;
  completedAt: string | null;
  servicesEnabled: boolean;
  serviceFocused: boolean;
  slug: string | null;
  setupChecklist: {
    percent: number;
    needsCountryConfirmation: boolean;
    items: { key: string; label: string; done: boolean; href: string }[];
  } | null;
};

export type OnboardingStep = {
  key: OnboardingStepKey;
  title: string;
  /** Qué hay que hacer (pendiente) o qué ya quedó (listo). */
  hint: string;
  done: boolean;
  /** Pantalla de la app donde se hace. */
  route: string;
  icon: 'business-outline' | 'pricetags-outline' | 'calendar-outline' | 'storefront-outline' | 'people-outline';
};

/** En el mismo orden que la web. La agenda aparece solo si el plan incluye servicios. */
export function buildOnboardingSteps(progress: OnboardingProgress): OnboardingStep[] {
  const { steps } = progress;
  const list: OnboardingStep[] = [
    {
      key: 'hasCompanyInfo', title: 'Datos del negocio', icon: 'business-outline', route: '/admin/settings/company', done: steps.hasCompanyInfo,
      hint: steps.hasCompanyInfo ? 'Nombre, teléfono y dirección cargados' : 'Cargá el teléfono, la dirección y la ciudad',
    },
    progress.serviceFocused
      ? {
          key: 'hasProducts', title: 'Servicios y precios', icon: 'pricetags-outline', route: '/panel/products/form', done: steps.hasProducts,
          hint: steps.hasProducts ? 'Ya tenés servicios cargados' : 'Cargá tu primer servicio con su precio',
        }
      : {
          key: 'hasProducts', title: 'Productos y catálogo', icon: 'pricetags-outline', route: '/panel/products/form', done: steps.hasProducts,
          hint: steps.hasProducts ? 'Ya tenés productos cargados' : 'Cargá tu primer producto con precio y foto',
        },
  ];
  if (progress.servicesEnabled) {
    list.push({
      key: 'hasAgenda', title: 'Agenda y reservas', icon: 'calendar-outline', route: '/panel/agenda', done: steps.hasAgenda,
      hint: steps.hasAgenda ? 'La agenda ya está en marcha' : 'Agendá tu primer turno',
    });
  }
  list.push(
    {
      key: 'hasPublicStore', title: 'Tienda pública', icon: 'storefront-outline', route: '/admin/website/domain', done: steps.hasPublicStore,
      hint: steps.hasPublicStore ? 'Tu tienda está publicada' : 'Publicá tu tienda para que te encuentren',
    },
    {
      key: 'hasTeam', title: 'Equipo de trabajo', icon: 'people-outline', route: '/admin/users', done: steps.hasTeam,
      hint: steps.hasTeam ? 'Ya sumaste a tu equipo' : 'Invitá a quienes trabajan con vos',
    },
  );
  return list;
}

export const doneCount = (steps: OnboardingStep[]) => steps.filter((step) => step.done).length;

/** El próximo paso a hacer, o null si están todos listos. */
export const nextStep = (steps: OnboardingStep[]) => steps.find((step) => !step.done) ?? null;

/**
 * Se muestra a quien configura el comercio mientras quede algo pendiente y no
 * lo haya ocultado en este teléfono.
 */
export const shouldShowFirstSteps = (steps: OnboardingStep[], hidden: boolean) => !hidden && steps.some((step) => !step.done);

/** Clave del «ocultar» en este teléfono, por comercio (SecureStore admite letras, números, «.», «-» y «_»). */
export const hiddenKey = (organizationId: string) => `first-steps-hidden.${organizationId.replace(/[^\w.-]/g, '')}`;

export function toOnboardingProgress(raw: Record<string, unknown> | null | undefined): OnboardingProgress {
  const data = (raw ?? {}) as Partial<OnboardingProgress>;
  const steps = (data.steps ?? {}) as Partial<Record<OnboardingStepKey, boolean>>;
  const checklist = data.setupChecklist;
  return {
    steps: {
      hasCompanyInfo: steps.hasCompanyInfo === true,
      hasProducts: steps.hasProducts === true,
      hasAgenda: steps.hasAgenda === true,
      hasPublicStore: steps.hasPublicStore === true,
      hasTeam: steps.hasTeam === true,
    },
    completedAt: typeof data.completedAt === 'string' ? data.completedAt : null,
    servicesEnabled: data.servicesEnabled === true,
    serviceFocused: data.serviceFocused === true,
    slug: typeof data.slug === 'string' ? data.slug : null,
    setupChecklist: checklist && typeof checklist === 'object' && Array.isArray(checklist.items)
      ? {
          percent: Number.isFinite(checklist.percent) ? Math.min(100, Math.max(0, checklist.percent)) : 0,
          needsCountryConfirmation: checklist.needsCountryConfirmation === true,
          items: checklist.items.filter((item): item is { key: string; label: string; done: boolean; href: string } =>
            Boolean(item && typeof item.key === 'string' && typeof item.label === 'string' && typeof item.done === 'boolean' && typeof item.href === 'string'),
          ),
        }
      : null,
  };
}
