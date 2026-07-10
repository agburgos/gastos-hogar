-- Presupuesto por subcategoría (opcional, además del de macrocategoría)
alter table categorias add column if not exists pct_objetivo numeric;
alter table categorias add column if not exists monto_objetivo numeric;

-- Permitir gestión dinámica de categorías por ambos usuarios (app familiar, sin roles admin)
create policy "authenticated pueden crear macros"
  on categorias_macro for insert
  to authenticated
  with check (true);

create policy "authenticated pueden editar macros"
  on categorias_macro for update
  to authenticated
  using (true);

create policy "authenticated pueden eliminar macros"
  on categorias_macro for delete
  to authenticated
  using (true);

create policy "authenticated pueden crear categorias"
  on categorias for insert
  to authenticated
  with check (true);

create policy "authenticated pueden editar categorias"
  on categorias for update
  to authenticated
  using (true);

create policy "authenticated pueden eliminar categorias"
  on categorias for delete
  to authenticated
  using (true);
