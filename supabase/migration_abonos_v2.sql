-- Corrección de semántica de abonos.
--
-- v1 restaba el abono del gasto: el gasto real del mes quedaba subvaluado
-- (el colegio de 1.536.000 aparecía como 869.000) y el saldo entre ambos
-- sólo se movía la mitad del abono.
--
-- Un abono NO es un gasto negativo: es plata que una persona le entrega a la
-- otra para saldar el mes. Por lo tanto NO entra en los totales de gasto —
-- se excluye — y su efecto vive sólo en el balance, que se calcula en la app.

create or replace view gasto_macro_mensual with (security_invoker = true) as
select cm.id as macro_id, cm.nombre as macro, cm.pct_objetivo,
       date_trunc('month', g.fecha)::date as mes,
       sum(g.monto) as total_gastado
from gastos g
join categorias c on c.id = g.categoria_id
join categorias_macro cm on cm.id = c.macro_id
where not g.es_abono
group by cm.id, cm.nombre, cm.pct_objetivo, date_trunc('month', g.fecha);

create or replace view balance_mensual with (security_invoker = true) as
select date_trunc('month', fecha)::date as mes,
  sum(monto) filter (where compartido and responsable_id = (select id from usuarios where nombre = 'Gloria Roa')) as pagado_gloria,
  sum(monto) filter (where compartido and responsable_id = (select id from usuarios where nombre = 'Alberto Garrido')) as pagado_alberto
from gastos
where not es_abono
group by 1;
