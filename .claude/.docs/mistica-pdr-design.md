# Product Design Requirements — Mística App
**Gestión de clases de natación · Design Edition**
Version 1.1 · April 2026

---

## 1. Overview

Mística is a mobile-first PWA for managing a swimming school — student enrollment, monthly billing, attendance, schedule management, and accessory sales. Operated by a single administrator from a phone browser.

**Stack:** Next.js 14 · Convex · Tailwind CSS · PWA

---

## 2. Design Vision

### 2.1 Reference & Inspiration

The UI draws from the provided mood board (soft mobile wellness app aesthetic) and adapts it to an operational, admin-facing tool. Key qualities to carry over:

- **Soft rounded cards** with generous padding — no harsh corners
- **Muted lavender / periwinkle as primary accent** (#7B6EF6 range), paired with warm off-white backgrounds (#F5F4FB)
- **Emoji-style status indicators** for payment and attendance state — friendly, instantly readable, not clinical
- **Large, bold typography** for key numbers and names (sleep = 7h 20min → payment = 250 Bs)
- **Bottom navigation bar** with icon-only tabs — exactly 4–5 items, rounded pill active state
- **Metric cards in 2-column grid** for dashboard stats
- **Full-bleed illustration or color on onboarding/splash** — the purple character splash maps to a pool/wave themed welcome screen for Mística

### 2.2 Palette

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#7B6EF6` | Active nav, CTAs, highlights |
| `--primary-light` | `#EAE8FE` | Card backgrounds, tag fills |
| `--accent-coral` | `#F28B72` | Overdue / alert state |
| `--accent-green` | `#72C472` | Paid / present state |
| `--accent-amber` | `#F5B942` | Pending / partial state |
| `--surface` | `#F5F4FB` | App background |
| `--card` | `#FFFFFF` | Card backgrounds |
| `--text-primary` | `#1A1826` | Headings, names |
| `--text-secondary` | `#7A7890` | Labels, subtitles |
| `--border` | `#E8E6F8` | Card borders, dividers |

### 2.3 Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| App wordmark | Nunito | 800 | 22px |
| Section headings | Nunito | 700 | 18px |
| Student names, key values | Nunito | 600 | 16px |
| Body / labels | Nunito | 400 | 14px |
| Micro labels, badges | Nunito | 500 | 12px |

Nunito's rounded terminals match the soft card aesthetic from the reference. Load via Google Fonts.

### 2.4 Component Language

**Cards**
- `border-radius: 20px` for main cards, `12px` for inner chips/badges
- `box-shadow: 0 2px 12px rgba(123,110,246,0.08)` — subtle lavender lift
- `padding: 20px` standard internal padding

**Status badges** — pill shape, emoji + text label

| Status | Emoji | Color |
|---|---|---|
| Paid | ✅ | Green fill `#E8F8E8`, text `#2E7D2E` |
| Pending | 🕐 | Amber fill `#FEF3DC`, text `#8A5E00` |
| Overdue | 🔴 | Coral fill `#FEECE8`, text `#8B2500` |
| Active | 🏊 | Primary fill `#EAE8FE`, text `#4A3DB8` |
| Inactive | ⚫ | Gray fill `#F0EFF5`, text `#7A7890` |

**Bottom nav** — 4 tabs, pill highlight on active
```
🏠 Inicio   👥 Alumnos   📋 Cobros   ☰ Más
```

**Quick-action buttons** — large, full-width, rounded-2xl, primary fill with white text. Used on Dashboard for daily core actions.

**Input fields** — `border-radius: 14px`, `height: 52px`, light lavender border on focus, label floats above.

**Attendance check-in row** — student name left, large tap target right (✅ / ❌ toggle), entire row is 64px tall minimum.

---

## 3. Screen Inventory

### 3.1 Splash / Onboarding
- Full-bleed background: soft purple-to-periwinkle gradient with subtle pool wave SVG illustration at the bottom
- Centered bold text: **"Hola, Mística 🏊"** → subtext "Gestión fácil de tus clases"
- Single CTA button: "Entrar"

### 3.2 Dashboard (Home tab)
Layout inspired by the reference's home screen — greeting header, emoji-status row, then metric cards.

```
┌─────────────────────────────┐
│  🌊 Buenos días, Mística    │   ← greeting + date
│                             │
│  [3 vencen hoy] [2 en mora] │   ← alert chips, coral if >0
│                             │
│  ┌──────────┐ ┌──────────┐  │
│  │ Alumnos  │ │  Cobros  │  │   ← metric cards 2-col
│  │    47    │ │ 8.450 Bs │  │
│  └──────────┘ └──────────┘  │
│                             │
│  Clases de hoy              │   ← section heading
│  ┌────────────────────────┐ │
│  │ 🕐 3–4 pm · 12 alumnos │ │   ← schedule cards
│  │ 🕐 4–5 pm · 8 alumnos  │ │
│  │ 🕐 5–6 pm · 5 alumnos  │ │
│  └────────────────────────┘ │
│                             │
│  Acciones rápidas           │
│  [+ Alumno] [✓ Asistencia]  │
│  [💰 Cobro] [🛍 Venta]      │
└─────────────────────────────┘
```

### 3.3 Students List (Alumnos tab)
- Search bar top (rounded pill, gray placeholder)
- Filter chips below: All · LMV · MJ · Agua Gym · Overdue
- Student card per row: avatar initials circle (lavender bg) + name + modality badge + payment status badge
- Tap row → Student Detail screen

### 3.4 Student Detail
- Header: large initials avatar, name (h2), phone number tap-to-call, status badge
- Info section: modality, time slot, enrollment date, renewal date (highlighted if within 7 days)
- Tab row: Pagos · Asistencias · Info
  - **Pagos tab:** chronological list of payments with status badges
  - **Asistencias tab:** monthly mini-calendar with emoji dots (like the reference's Mood Calendar)
  - **Info tab:** editable fields

### 3.5 New / Edit Student
Fields in a single scrollable form:
1. Full name *
2. Phone number (tel input, tap-to-call) *
3. Date of birth *
4. Enrollment date (defaults to today) *
5. Modality (segmented control: LMV · MJ · Agua Gym 3x · Agua Gym 5x)
6. Time slot (dropdown, filtered by modality)
7. Status (Active / Suspended / Withdrawn)
8. Notes (textarea, optional)

Save → floating primary button at bottom.

### 3.6 Billing (Cobros tab)
- Tabs: Pendientes · Pagados · Todos
- Each item: student name, due date, amount, status badge
- Overdue rows get a subtle coral left-border accent
- Tap → mark as paid (one tap, no receipt generated)
- FAB: + Manual payment record

### 3.7 Attendance
- Accessible from Dashboard quick-action or from a student's Asistencias tab
- Top: date picker + time slot selector (pill segmented control)
- Below: student list for that slot. Each row 64px, full-width tap target for toggle
- Saved in real time (Convex), no submit button needed

### 3.8 Product Sales
- Simple list of sales, newest first
- Each sale: product name, quantity, price, date
- FAB: + Nueva venta → bottom sheet with product name, qty, unit price, optional student
- Saved product list for quick reuse

### 3.9 Settings (Más tab → Configuración)
See Section 6 for full config spec.

---

## 4. Business Rules (Updated)

### 4.1 Pricing — Swimming

| Modality | Days | Monthly | Enrollment |
|---|---|---|---|
| Natación LMV | Mon · Wed · Fri | 250 Bs | 60 Bs |
| Natación MJ | Tue · Thu | 220 Bs | 60 Bs |

### 4.2 Pricing — Aqua Gym

| Modality | Days | Monthly | Enrollment |
|---|---|---|---|
| Agua Gym 3x | Mon · Wed · Fri | 250 Bs | 60 Bs |
| Agua Gym 5x | Mon – Fri (fixed) | 300 Bs | 60 Bs |

> "Agua Gym 5x" = Monday through Friday, fixed. No custom day selection.
> Enrollment fee (60 Bs) charged once at registration, non-refundable.
> No payment receipts generated by the system — payments are recorded manually.

### 4.3 Default Schedule

| Days | Slots |
|---|---|
| Mon · Wed · Fri | 3:00–4:00 · 4:00–5:00 · 5:00–6:00 pm |
| Tue · Thu | 3:00–4:00 · 4:00–5:00 · 5:00–6:00 pm |

Schedules are fully configurable (see Section 6).

---

## 5. Data Model (Convex)

```ts
// students
{
  _id, name, phone, dob, enrollmentDate,
  modality: "lmv" | "mj" | "aquagym3x" | "aquagym5x",
  timeSlotId, status: "active" | "suspended" | "withdrawn",
  notes, createdAt
}

// timeSlots
{
  _id, label, days: string[], startTime, endTime,
  isActive, maxCapacity   // configurable group size limit
}

// attendance
{
  _id, studentId, timeSlotId, date, present, recordedAt
}

// payments
{
  _id, studentId, type: "enrollment" | "monthly",
  amount, dueDate, paidAt, status: "pending" | "paid" | "overdue",
  notes
}

// products
{
  _id, name, defaultPrice, isActive
}

// sales
{
  _id, productId, productName, unitPrice,
  quantity, total, date, studentId   // optional
}

// appConfig
{
  _id, key, value   // key-value store for all settings
}
```

---

## 6. Configuration Module

Accessible from **Más → Configuración**. All settings persist in Convex `appConfig` table.

### 6.1 Business Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| School name | text | Mística | Shown in header and reports |
| Currency symbol | text | Bs | Displayed next to all prices |
| Payment due day | number (1–31) | Enrollment day | Day of month renewal is due |
| Alert days before due | number | 7 | Days ahead to show expiry warning on dashboard |

### 6.2 Pricing Settings

All prices editable per modality. Changes apply to new records only — existing payment records are not retroactively modified.

| Field | Default |
|---|---|
| Natación LMV — monthly | 250 Bs |
| Natación MJ — monthly | 220 Bs |
| Agua Gym 3x — monthly | 250 Bs |
| Agua Gym 5x — monthly | 300 Bs |
| Enrollment fee (all) | 60 Bs |

### 6.3 Schedule & Capacity Settings

Per time slot:

| Setting | Type | Default | Description |
|---|---|---|---|
| Max capacity | number | 15 | Max students per slot. System warns (not blocks) when slot is full |
| Slot label | text | e.g. "LMV 4–5 pm" | Friendly display name |
| Days | multi-select | — | Which days this slot meets |
| Start / end time | time picker | — | Editable at any time |
| Active | toggle | true | Inactive slots hidden from assignment |

> Capacity is a **soft limit** — admin sees a warning ("Este turno está completo — ¿continuar?") but can override and add the student anyway.

### 6.4 Modality Settings

| Setting | Type | Default |
|---|---|---|
| Enable/disable a modality | toggle | All enabled |
| Custom modality name | text | As defined above |

### 6.5 Attendance Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| Auto-mark absent | toggle | Off | If on, unmarked students are auto-marked absent at end of day |
| Editable past days | number | 7 | How many days back attendance can be edited |

### 6.6 Notification Settings (v1 — manual dashboard only)

| Setting | Type | Default |
|---|---|---|
| Show overdue alert on dashboard | toggle | On |
| Show expiring-soon alert on dashboard | toggle | On |
| Days ahead for expiry alert | number | 7 |

---

## 7. Overdue Handling

Overdue payments are **flagged only** — no automatic suspension.

- Dashboard shows count of overdue students with coral badge
- Student list row shows 🔴 Overdue badge
- Student detail Pagos tab shows the overdue record with coral accent
- No automated action taken — admin decides how to follow up
- Admin can manually change student status to Suspended if needed

---

## 8. UX Principles

- **3-tap rule:** Core daily actions (mark attendance, record payment, register sale) complete in 3 taps or fewer
- **No confirmation dialogs** for routine actions — use optimistic UI + undo toast (3s) instead
- **Tap targets minimum 48×48px** — especially attendance toggle rows (64px height)
- **Phone number is tappable** — `<a href="tel:+...">` on all student detail views
- **Offline resilience** — Convex handles sync; show a subtle top banner "Sin conexión — guardando localmente" when offline
- **Empty states** — friendly illustrated empty states with a CTA (e.g. "Todavía no hay alumnos · + Agregar primero")

---

## 9. Accessibility

- Minimum font size: 16px body, 14px labels — never smaller
- Color is never the only status indicator — always paired with emoji or text label
- Focus rings visible on all interactive elements (for keyboard/switch access)
- All form fields have associated visible labels (not just placeholder)

---

## 10. Development Phases

| Phase | Scope | Notes |
|---|---|---|
| 1 | Students + Schedules | Includes phone field, capacity config |
| 2 | Attendance + Billing | Overdue flagging, no receipts |
| 3 | Product Sales + Reports | Sales recording only, no inventory |
| 4 | Dashboard + Config module + PWA polish | All settings from Section 6 |
| 5 | AI layer | Reminders, automation — future |

---

## 11. Resolved Questions

| Question | Answer |
|---|---|
| Overdue = suspend or flag? | **Flag only** — admin decides action |
| Receipt on payment? | **No** — no receipt generated |
| Agua Gym 5x = any 5 days or Mon–Fri? | **Mon–Fri fixed** |
| Group size limits? | **Soft limit per slot** — configurable, warns but allows override |
| Product inventory tracking? | **Sales recording only** — no stock count in v1 |

---

*Mística · Design PDR v1.1 · Ready for Phase 1 kickoff*
