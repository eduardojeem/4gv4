-- Corrige las URLs publicas de los planes "Pro" y "PRO+".
--
-- El backfill original derivaba el slug del nombre y, si dos planes producian el
-- mismo, ambos caian al tier. "Pro" y "PRO+" se limpian los dos a `pro`, asi que
-- los dos cayeron:
--
--   tier=basic  name="Pro"   public_slug='basic'
--   tier=pro    name="PRO+"  public_slug='pro'
--
-- El resultado no es solo feo: `/register?plan=pro` lleva a PRO+ (150.000),
-- mientras que el plan que se llama "Pro" es `basic` (100.000). Alguien que arma
-- ese enlace pensando en "Pro" manda a sus clientes al plan equivocado.
--
-- El orden de los UPDATE importa: `public_slug` tiene un indice unico, asi que
-- primero hay que liberar `pro` y recien despues asignarlo.

begin;

-- 1. PRO+ suelta `pro`.
update public.subscription_plans
set public_slug = 'pro-plus', updated_at = now()
where tier = 'pro'
  and public_slug = 'pro';

-- 2. Pro lo toma. Solo si quedo libre: si el paso anterior no encontro su fila
--    —porque el nombre o el tier cambiaron— este no debe pisar nada.
update public.subscription_plans
set public_slug = 'pro', updated_at = now()
where tier = 'basic'
  and public_slug = 'basic'
  and not exists (
    select 1 from public.subscription_plans otro
    where otro.public_slug = 'pro' and otro.tier <> 'basic'
  );

commit;

-- Enlaces viejos: `/register?plan=pro` pasa a significar "Pro" en vez de "PRO+".
-- El registro resuelve primero por slug publico y solo despues por tier, asi que
-- el nuevo significado gana de forma deterministica. Quien tenga guardado un
-- enlace a PRO+ va a ver "Pro" (mas barato), no un error: conviene rehacer los
-- enlaces que esten publicados antes de aplicar esto.
