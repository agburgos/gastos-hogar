-- Marca si la deuda está generando cuotas automáticas como gasto mensual
alter table deudas add column if not exists pagando boolean not null default false;

-- La vista debe exponer la nueva columna (se agrega al final, ver nota en migration_ambito_acreedor.sql)
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
  d.acreedor_id,
  d.pagando
from deudas d
where d.responsable_id = auth.uid() or d.acreedor_id = auth.uid();
