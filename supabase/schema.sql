-- Esquema para la app de control de gasto familiar (Gloria Roa / Alberto Garrido)
-- Ejecutar en Supabase: Project > SQL Editor > New query, contra un proyecto nuevo.

create extension if not exists "pgcrypto";

-- ── Categorías ────────────────────────────────────────────────────────────

create table categorias_macro (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  pct_objetivo numeric not null,   -- fracción del ingreso mensual, ej. 0.35
  orden int not null
);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  macro_id uuid not null references categorias_macro(id) on delete restrict,
  nombre text not null,
  orden int not null default 0,
  unique (macro_id, nombre)
);

-- ── Usuarios (sincronizados con Supabase Auth) ──────────────────────────────

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Ingreso mensual (ledger: cada fila rige desde su fecha en adelante) ────

create table ingreso_mensual (
  id uuid primary key default gen_random_uuid(),
  monto numeric not null,
  vigente_desde date not null,
  created_at timestamptz not null default now()
);

-- ── Gastos ──────────────────────────────────────────────────────────────

create table gastos (
  id uuid primary key default gen_random_uuid(),
  monto numeric not null check (monto > 0),
  descripcion text,
  categoria_id uuid not null references categorias(id) on delete restrict,
  responsable_id uuid not null references usuarios(id) on delete restrict,
  fecha date not null default current_date,
  compartido boolean not null default true,
  cuota_grupo_id uuid,
  cuota_numero int,
  cuota_total int,
  revisar boolean not null default false,
  created_at timestamptz not null default now()
);
create index gastos_fecha_idx on gastos (fecha);
create index gastos_categoria_idx on gastos (categoria_id);

-- ── Push subscriptions ──────────────────────────────────────────────────

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ── Vistas ──────────────────────────────────────────────────────────────
-- security_invoker = true es obligatorio: en Postgres 15+ las vistas corren
-- con los privilegios de quien las creó salvo que se declare esto, lo que
-- se saltaría el RLS de "gastos" en silencio.

create view gasto_macro_mensual with (security_invoker = true) as
select cm.id as macro_id, cm.nombre as macro, cm.pct_objetivo,
       date_trunc('month', g.fecha)::date as mes, sum(g.monto) as total_gastado
from gastos g
join categorias c on c.id = g.categoria_id
join categorias_macro cm on cm.id = c.macro_id
group by cm.id, cm.nombre, cm.pct_objetivo, date_trunc('month', g.fecha);

create view balance_mensual with (security_invoker = true) as
select date_trunc('month', fecha)::date as mes,
  sum(monto) filter (where compartido and responsable_id = (select id from usuarios where nombre = 'Gloria Roa')) as pagado_gloria,
  sum(monto) filter (where compartido and responsable_id = (select id from usuarios where nombre = 'Alberto Garrido')) as pagado_alberto
from gastos
group by 1;

-- ── RLS ─────────────────────────────────────────────────────────────────

alter table categorias_macro enable row level security;
alter table categorias enable row level security;
alter table usuarios enable row level security;
alter table ingreso_mensual enable row level security;
alter table gastos enable row level security;
alter table push_subscriptions enable row level security;

create policy "auth_select_categorias_macro" on categorias_macro for select
  using (auth.role() = 'authenticated');
create policy "auth_select_categorias" on categorias for select
  using (auth.role() = 'authenticated');

create policy "auth_select_usuarios" on usuarios for select
  using (auth.role() = 'authenticated');
create policy "auth_update_own_usuario" on usuarios for update
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "auth_select_ingreso_mensual" on ingreso_mensual for select
  using (auth.role() = 'authenticated');
create policy "auth_insert_ingreso_mensual" on ingreso_mensual for insert
  with check (auth.role() = 'authenticated');

create policy "auth_select_gastos" on gastos for select
  using (auth.role() = 'authenticated');
create policy "own_insert_gastos" on gastos for insert
  with check (auth.uid() = responsable_id);
create policy "own_update_gastos" on gastos for update
  using (auth.uid() = responsable_id) with check (auth.uid() = responsable_id);
create policy "own_delete_gastos" on gastos for delete
  using (auth.uid() = responsable_id);

create policy "own_all_push_subscriptions" on push_subscriptions for all
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- Sincroniza retroactivamente cualquier usuario de Auth que ya exista
-- y todavía no tenga fila en "usuarios" (por si se crean antes de correr esto).
insert into public.usuarios (id, email, nombre)
select id, email, split_part(email, '@', 1)
from auth.users
on conflict (id) do nothing;
