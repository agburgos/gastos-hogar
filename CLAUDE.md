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

🚀 **PRODUCCIÓN LISTA**

URL: https://gastos-hogar-iota.vercel.app

Completado:

- ✓ Schema (categorías, usuarios, gastos, deudas, ingreso_mensual)
- ✓ Seed: 10 macrocategorías + 66 subcategorías
- ✓ Auth: Gloria Roa + Alberto Garrido
- ✓ Dashboard (presupuesto en vivo por macro con ProgressBar)
- ✓ Registro rápido (monto → categoría 2-tap → fecha → compartido → cuotas)
- ✓ Resumen (tabla gastos/mes)
- ✓ Balance (quién pagó cuánto, quién debe)
- ✓ Revisar (reclasificar gastos sin categoría)
- ✓ **Deudas (México, MBA, etc)** — registrar + calcular pendiente + pagar
- ✓ Ajustes (ingreso, estado push, logout)
- ✓ Histórico migrado: 122 gastos de Excel (2022-2026)
- ✓ Deployed: Vercel + Supabase Cloud

Pendiente:

- Notificaciones Push (PWA con VAPID)
- Pulido: iconos, manifest, install prompt
- Fine-tune Excel parser (algunas hojas con formato inconsistente)

---

## Regla importante

No modificar el modelo de datos sin justificación.

Siempre revisar primero el repositorio antes de crear nuevos archivos.
