-- Marca gastos recurrentes (ej: arriendo) — al activarlo se generan las próximas ocurrencias
alter table gastos add column if not exists recurrente boolean not null default false;
