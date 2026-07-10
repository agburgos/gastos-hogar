-- Tabla de deudas/préstamos
create table if not exists deudas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  monto_total numeric not null check (monto_total > 0),
  monto_pagado numeric not null default 0 check (monto_pagado >= 0),
  cuota_mensual numeric,
  fecha_inicio date not null default current_date,
  fecha_vencimiento date,
  responsable_id uuid not null references usuarios(id) on delete restrict,
  descripcion text,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices
create index if not exists deudas_responsable_idx on deudas (responsable_id);
create index if not exists deudas_activa_idx on deudas (activa);

-- RLS: cada usuario solo ve sus deudas
alter table deudas enable row level security;

create policy "usuarios ven sus propias deudas"
  on deudas for select
  using (auth.uid() = responsable_id);

create policy "usuarios crean sus propias deudas"
  on deudas for insert
  with check (auth.uid() = responsable_id);

create policy "usuarios actualizan sus propias deudas"
  on deudas for update
  using (auth.uid() = responsable_id);

-- Vista: deudas con saldo pendiente calculado
create or replace view deuda_saldos with (security_invoker = true) as
select
  d.id,
  d.nombre,
  d.monto_total,
  d.monto_pagado,
  (d.monto_total - d.monto_pagado) as saldo_pendiente,
  d.cuota_mensual,
  d.fecha_inicio,
  d.fecha_vencimiento,
  d.responsable_id,
  d.descripcion,
  d.activa,
  d.created_at
from deudas d
where d.responsable_id = auth.uid();
