-- Clasificación mayor: a qué propiedad pertenece el gasto
alter table gastos add column if not exists ambito text not null default 'ninguno'
  check (ambito in ('casa', 'parcela', 'ambos', 'ninguno'));

-- Deudas: quién debe (deudor, ya existe como responsable_id) y a quién se le debe (acreedor)
alter table deudas add column if not exists acreedor_id uuid references usuarios(id) on delete set null;

-- Permitir que el acreedor también vea la deuda (no solo el deudor)
drop policy if exists "usuarios ven sus propias deudas" on deudas;
create policy "deudor y acreedor ven la deuda"
  on deudas for select
  using (auth.uid() = responsable_id or auth.uid() = acreedor_id);

-- La vista debe incluir deudas donde soy deudor O acreedor
-- (drop + create porque CREATE OR REPLACE no permite reordenar columnas)
drop view if exists deuda_saldos;
create view deuda_saldos with (security_invoker = true) as
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
  d.created_at,
  d.acreedor_id
from deudas d
where d.responsable_id = auth.uid() or d.acreedor_id = auth.uid();
