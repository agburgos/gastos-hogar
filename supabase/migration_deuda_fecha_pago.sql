-- Fecha en que empieza a descontarse la cuota mensual automáticamente.
-- Reemplaza el enfoque anterior de generar gastos falsos por cada cuota:
-- ahora el saldo se descuenta solo, calculado por meses transcurridos.
alter table deudas add column if not exists fecha_activacion_pago date;

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
  d.pagando,
  d.cuota_grupo_id,
  d.fecha_activacion_pago
from deudas d
where d.responsable_id = auth.uid() or d.acreedor_id = auth.uid();
