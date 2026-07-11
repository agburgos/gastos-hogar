-- Permitir que cualquier usuario autenticado registre gastos para cualquier persona
-- Anterior: solo podías registrar gastos para ti mismo
-- Ahora: Gloria puede registrar gastos de Alberto y viceversa

drop policy if exists "own_insert_gastos" on gastos;

create policy "auth_insert_gastos" on gastos for insert
  with check (auth.role() = 'authenticated');
