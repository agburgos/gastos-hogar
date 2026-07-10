# Gastos Hogar

## Objetivo

Aplicación de control de gasto familiar para Alberto Garrido y Gloria Roa.

La aplicación reemplaza la planilla Excel histórica de gastos familiares utilizada desde 2022.

El objetivo principal es registrar gastos con categoría obligatoria, controlar presupuesto por categoría en tiempo real y mantener balance compartido entre ambos usuarios.

---

## Stack

- Next.js 16
- React 19
- Tailwind v4
- Supabase
- TypeScript

---

## Usuarios

- Gloria Roa
- Alberto Garrido

---

## Puertos

- Next.js: 3003

---

## Supabase

Tablas principales:

- categorias_macro
- categorias
- usuarios
- ingreso_mensual
- gastos
- push_subscriptions

Views:

- gasto_macro_mensual
- balance_mensual

RLS habilitado.

---

## Estado actual

Completado:

- schema.sql aplicado
- seed.sql aplicado
- usuarios creados en Authentication
- trigger handle_new_user funcionando
- AuthGate portado
- LoginForm portado
- NavTabs portado
- layout base portado
- ✓ Servidor corriendo en puerto 3003 (webpack, sin Turbopack)
- ✓ Dashboard principal (app/page.tsx → macros con ProgressBar, balance)
- ✓ Registro rápido (app/nuevo/page.tsx → 2-tap categoría picker, cuotas)
- ✓ Resumen (app/resumen/page.tsx → tabla gastos/mes)
- ✓ Balance (app/balance/page.tsx → Gloria/Alberto, deuda)
- ✓ Revisar (app/revisar/page.tsx → reclasificar gastos sin categoría)
- ✓ Ajustes (app/ajustes/page.tsx → ingreso, push, logout)
- ✓ Migración del Excel histórico: **122 gastos cargados** (2022-2026)
- ✓ Deployed to Vercel (awaiting env vars)

Pendiente:

- Notificaciones Push PWA (VAPID, service worker, API endpoints)
- Polish: PWA icons, manifest, install prompts
- Fine-tune Excel migration (algunas hojas con estructura inconsistente)

---

## Regla importante

No modificar el modelo de datos sin justificación.

Siempre revisar primero el repositorio antes de crear nuevos archivos.
