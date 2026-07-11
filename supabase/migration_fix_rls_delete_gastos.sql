-- Permitir que cualquier usuario autenticado elimine gastos (no solo los propios)
-- Esto acompaña el cambio anterior donde se permite registrar gastos ajenos

drop policy if exists "own_delete_gastos" on gastos;

create policy "auth_delete_gastos" on gastos for delete
  using (auth.role() = 'authenticated');

-- También arreglamos UPDATE por si acaso
drop policy if exists "own_update_gastos" on gastos;

create policy "auth_update_gastos" on gastos for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
