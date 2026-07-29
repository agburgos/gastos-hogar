-- Gasto pagado por una persona pero 100% atribuible a la otra.
-- Ej: Gloria compra el prestobarba de Alberto en el super: ella paga, pero
-- Alberto le debe el 100% (no la mitad).
--
-- beneficiario_id = de quién es el gasto (quién asume el 100%).
--   null                          -> se usa "compartido" como antes (true=50/50, false=personal)
--   = responsable_id              -> personal de quien paga (sin efecto en el balance)
--   != responsable_id             -> 100% cargado al beneficiario; el pagador queda a favor por el total

alter table gastos add column if not exists beneficiario_id uuid references usuarios(id);
