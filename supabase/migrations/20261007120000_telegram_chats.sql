-- La tienda que eligió cada chat del bot de Telegram.
--
-- Un solo bot atiende a todas las tiendas: el cliente llega con el enlace
-- t.me/<bot>?start=<slug> o elige con /tienda, y el bot tiene que recordarlo
-- en los mensajes siguientes. organization_id null = «todas las tiendas».
--
-- Sólo la usa el servidor con la service role: RLS activo y sin políticas.

create table if not exists public.telegram_chats (
  chat_id bigint primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_chats_organization_id_idx
  on public.telegram_chats (organization_id);

alter table public.telegram_chats enable row level security;

revoke all on public.telegram_chats from anon, authenticated;
