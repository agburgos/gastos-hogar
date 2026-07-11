-- Agregar "Arriendo" a Vivienda como la primera subcategoría
-- Ejecutar en Supabase Studio → SQL Editor

insert into categorias (macro_id, nombre, orden)
select id, 'Arriendo', 1
from categorias_macro
where nombre = 'Vivienda'
on conflict (macro_id, nombre) do nothing;

-- Actualizar órdenes de las otras subcategorías de Vivienda para mantener coherencia
update categorias
set orden = orden + 1
where macro_id = (select id from categorias_macro where nombre = 'Vivienda')
  and nombre != 'Arriendo';
