-- Seed de categorías fijas. Ejecutar una sola vez, después de schema.sql.

with macro as (
  insert into categorias_macro (nombre, pct_objetivo, orden) values
    ('Vivienda', 0.35, 1),
    ('Alimentación', 0.20, 2),
    ('Transporte', 0.22, 3),
    ('Deudas', 0.20, 4),
    ('Salud', 0.08, 5),
    ('Recreación', 0.05, 6),
    ('Hijos', 0.08, 7),
    ('Seguros', 0.05, 8),
    ('Otros', 0.05, 9),
    ('Sin Clasificar', 0, 10)
  returning id, nombre
)
insert into categorias (macro_id, nombre, orden)
select m.id, sub.nombre, sub.orden
from macro m
join (values
  ('Vivienda', 'Dividendo', 1),
  ('Vivienda', 'Gastos Comunes', 2),
  ('Vivienda', 'Celular', 3),
  ('Vivienda', 'Gas', 4),
  ('Vivienda', 'Electricidad', 5),
  ('Vivienda', 'Agua', 6),
  ('Vivienda', 'Internet', 7),
  ('Vivienda', 'Mantenimiento', 8),
  ('Vivienda', 'Otros suministros', 9),
  ('Vivienda', 'Nana', 10),
  ('Vivienda', 'Contribuciones', 11),
  ('Vivienda', 'Lavandería', 12),
  ('Vivienda', 'Otros - vivienda', 13),

  ('Alimentación', 'Supermercado', 1),
  ('Alimentación', 'Restaurantes', 2),
  ('Alimentación', 'Feria', 3),
  ('Alimentación', 'Otras compras menores', 4),
  ('Alimentación', 'Otros - Alimentación', 5),

  ('Transporte', 'Locomoción Pública', 1),
  ('Transporte', 'Permiso Circulación', 2),
  ('Transporte', 'Revisión Técnica', 3),
  ('Transporte', 'Combustible', 4),
  ('Transporte', 'Uber', 5),
  ('Transporte', 'Peajes y/o TAG', 6),
  ('Transporte', 'Otros - Transporte', 7),

  ('Deudas', 'Visa Chile', 1),
  ('Deudas', 'Mastercard Chile', 2),
  ('Deudas', 'Ripley', 3),
  ('Deudas', 'Falabella', 4),
  ('Deudas', 'Cencosud', 5),
  ('Deudas', 'Otros - deudas crédito', 6),

  ('Salud', 'Gastos Médicos', 1),
  ('Salud', 'Farmacia', 2),
  ('Salud', 'Bonos', 3),
  ('Salud', 'Isapre', 4),
  ('Salud', 'Actividades Deportivas', 5),
  ('Salud', 'Otros - salud', 6),

  ('Recreación', 'Cine', 1),
  ('Recreación', 'Conciertos', 2),
  ('Recreación', 'Eventos', 3),
  ('Recreación', 'Pub''s', 4),
  ('Recreación', 'Restaurantes', 5),
  ('Recreación', 'Suscripciones', 6),
  ('Recreación', 'Otros - recreación', 7),

  ('Hijos', 'Ropa', 1),
  ('Hijos', 'Jardín', 2),
  ('Hijos', 'Mesada', 3),
  ('Hijos', 'Materiales Escolares', 4),
  ('Hijos', 'Recreación', 5),
  ('Hijos', 'Celular', 6),
  ('Hijos', 'Isapre', 7),
  ('Hijos', 'Otros - hijos', 8),

  ('Seguros', 'Seguro de Vida', 1),
  ('Seguros', 'Seguro de Estudios', 2),
  ('Seguros', 'Seguro de Salud', 3),
  ('Seguros', 'Seguro Automotriz', 4),
  ('Seguros', 'Seguro de Hogar', 5),
  ('Seguros', 'Seguro de Accidentes', 6),
  ('Seguros', 'Otros - seguros', 7),

  ('Otros', 'Regalos', 1),
  ('Otros', 'Imprevistos', 2),
  ('Otros', 'Donaciones', 3),
  ('Otros', 'Artículos Personales', 4),
  ('Otros', 'Cajero', 5),
  ('Otros', 'Otros - otros', 6),

  ('Sin Clasificar', 'Sin clasificar', 1)
) as sub(macro_nombre, nombre, orden) on sub.macro_nombre = m.nombre;
