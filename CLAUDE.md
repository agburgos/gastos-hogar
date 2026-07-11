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

- categorias_macro (con pct_objetivo)
- categorias (con pct_objetivo y monto_objetivo opcionales)
- usuarios
- ingreso_mensual (ledger append-only)
- gastos (con ambito: casa/parcela/ambos/ninguno)
- deudas (con acreedor_id para modelo deudor/acreedor)
- push_subscriptions

Views:

- gasto_macro_mensual (security_invoker=true)
- balance_mensual (security_invoker=true)
- deuda_saldos (security_invoker=true, ambos ven deudas donde son deudor O acreedor)

RLS habilitado (per-user, no anon-key abierto).

---

## Estado actual

🚀 **PRODUCCIÓN LISTA — FEATURES COMPLETAS**

URL: https://gastos-hogar-iota.vercel.app

### Core completado:

- ✓ Schema: categorías (10 macro + 66 sub con presupuesto), usuarios, gastos (con ámbito), deudas (deudor/acreedor), ingreso_mensual
- ✓ Auth: Gloria Roa + Alberto Garrido (login separado, RLS per-user)
- ✓ Dashboard: presupuesto en vivo por macro, alertas por subcategoría (80%/100%), resumen gastos por persona
- ✓ Registro rápido: monto → categoría 2-tap → fecha → compartido → cuotas → **título obligatorio** + ámbito
- ✓ Resumen: tabla gastos/mes con selector mes/año
- ✓ Balance: quién pagó cuánto, quién debe (deudas incluidas en cálculo)
- ✓ **Detalle**: grilla expandible macro→categoría→responsable×día, filtros mes, editar/eliminar gastos inline, cajas Gloria/Alberto
- ✓ Revisar: reclasificar gastos sin categoría
- ✓ **Deudas**: modelo completo deudor/acreedor, "Yo debo" vs "Me deben", registrar + pagar + historial
- ✓ **Ajustes (Mantenedor)**: crear/editar/eliminar macrocategorías y subcategorías dinámicamente con presupuesto
- ✓ Config: actualizar ingreso mensual (ledger), logout
- ✓ Histórico: 122 gastos de Excel (2022-2026) migrados
- ✓ Deployed: Vercel + Supabase Cloud
- ✓ Layout: ancho completo en desktop (lg:max-w-6xl), responsivo en mobile (480px)

### Última actualización (sesión actual):

- ✓ Título del gasto **obligatorio** — validación en form + botón deshabilitado sin título
- ✓ **Ámbito** (Casa/Parcela/Ambos/Ninguno) — nuevo selector en Nuevo Gasto, editable desde Detalle
- ✓ **Deudas rediseñadas** — modelo deudor/acreedor completo (ambos ven la deuda), no solo responsable
- ✓ Página Deudas mejorada — cajas "Yo debo" / "Me deben" separadas, cálculo neto por persona
- ✓ **Bug fix crítico** — dashboard calculaba deudas desde tabla gastos (saldo_pendiente no existe ahí, solo en vista deuda_saldos)
- ✓ Cajas Gloria/Alberto en Detalle — muestra total gastado por responsable en mes seleccionado

### Pendiente (nice-to-have):

- Notificaciones Push (PWA con VAPID)
- Pulido PWA: iconos, manifest, install prompt

---

## Regla importante

No modificar el modelo de datos sin justificación.

Siempre revisar primero el repositorio antes de crear nuevos archivos.
