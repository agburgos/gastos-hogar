-- Abonos: registros que DESCUENTAN del gasto del mes (ej: devoluciones,
-- pagos parciales recibidos). Se muestran en verde y restan en todos los cálculos.

alter table gastos add column if not exists es_abono boolean not null default false;

-- Las vistas deben restar los abonos en vez de sumarlos
create or replace view gasto_macro_mensual with (security_invoker = true) as
select cm.id as macro_id, cm.nombre as macro, cm.pct_objetivo,
       date_trunc('month', g.fecha)::date as mes,
       sum(case when g.es_abono then -g.monto else g.monto end) as total_gastado
from gastos g
join categorias c on c.id = g.categoria_id
join categorias_macro cm on cm.id = c.macro_id
group by cm.id, cm.nombre, cm.pct_objetivo, date_trunc('month', g.fecha);

create or replace view balance_mensual with (security_invoker = true) as
select date_trunc('month', fecha)::date as mes,
  sum(case when es_abono then -monto else monto end)
    filter (where compartido and responsable_id = (select id from usuarios where nombre = 'Gloria Roa')) as pagado_gloria,
  sum(case when es_abono then -monto else monto end)
    filter (where compartido and responsable_id = (select id from usuarios where nombre = 'Alberto Garrido')) as pagado_alberto
from gastos
group by 1;
