# Architecture — Syndet Shampoo Bar Formulator

This document describes the internal architecture, data models, algorithms, and domain knowledge embedded in the formulator. It's written for developers who need to understand, modify, or extend the application.

## Table of Contents

1. [Application Overview](#application-overview)
2. [Data Model: Ingredients](#data-model-ingredients)
3. [Data Model: Templates](#data-model-templates)
4. [Data Model: Hair Goals](#data-model-hair-goals)
5. [Formula State & Operations](#formula-state--operations)
6. [Validation Engine](#validation-engine)
7. [Property Computation](#property-computation)
8. [Smart Swap System](#smart-swap-system)
9. [Balance Algorithm](#balance-algorithm)
10. [Unit System & Anchor](#unit-system--anchor)
11. [Print View](#print-view)
12. [Recipe Persistence](#recipe-persistence)
13. [UI Architecture](#ui-architecture)
14. [Domain Knowledge Reference](#domain-knowledge-reference)

---

## 1. Application Overview

The formulator is a single React component (`SyndetFormulator`) that manages formula state via `useState` hooks. There's no routing, no external state management, no backend. The entire app is rendered in one function component.

### Rendering Modes

The component has two rendering paths:

```
if (showPrint) → PrintView (clean monospace recipe page)
else           → Main Formulator (two-panel editor)
```

### Layout

Main formulator is a flex row:

```
┌──────────────────────────────────────────────────────┐
│  HEADER: Title · Reset · Save · Saved · Print        │
│  Recipe Name Input · Sources                         │
├──────────────────────┬───────────────────────────────┤
│  LEFT PANEL          │  RIGHT PANEL                  │
│  (scrollable)        │  (scrollable)                 │
│                      │                               │
│  Templates (buttons) │  Swap Notice (if active)      │
│  Goals (buttons)     │  Validation messages           │
│  Goal Detail (if     │  Goal-aware checks            │
│    goal selected)    │  Selected ingredient detail   │
│  Add Ingredients     │    - Properties               │
│  Ingredient List     │    - Substitutions            │
│    (drag to reorder) │  Phase Breakdown              │
│                      │  Properties (ASM, lather...)  │
│                      │  Recipe Notes                 │
├──────────────────────┴───────────────────────────────┤
│  BOTTOM BAR: Total% · ⚖ Balance · Unit · Batch · +Add│
└──────────────────────────────────────────────────────┘
```

The root container uses `height: "100vh"` (not `minHeight`) to create a fixed viewport that enables overflow scrolling in both panels.

---

## 2. Data Model: Ingredients

### `INGREDIENTS[]` — Master Database

Array of ~55 ingredient objects. Each ingredient belongs to one of these functional slots:

```js
const FUNCTIONAL_SLOTS = {
  PRIMARY_SURFACTANT:    "Primary Surfactant",
  SECONDARY_SURFACTANT:  "Secondary Surfactant",
  LIQUID_SURFACTANT:     "Liquid Surfactant",
  FILLER:                "Filler / Body",
  HARDENER:              "Hardener",
  CONDITIONING:          "Conditioning Agent",
  OIL_BUTTER:            "Oil / Butter",
  PROTEIN:               "Protein",
  HUMECTANT:             "Humectant",
  PH_ADJUSTER:           "pH Adjuster",
  PRESERVATIVE:          "Preservative",
  FRAGRANCE:             "Fragrance / EO",
  COLORANT:              "Colorant",
  SPECIALTY:             "Specialty Additive",
};
```

Some ingredients span two slots via `alsoSlot` (e.g., BTMS-50 is both CONDITIONING and HARDENER).

### Ingredient Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✓ | Unique key, snake_case (e.g., `"sci"`, `"cocoa_butter"`) |
| `name` | string | ✓ | Display name, may include abbreviation in parens |
| `slot` | string | ✓ | Primary functional category (key of FUNCTIONAL_SLOTS) |
| `alsoSlot` | string | — | Secondary functional category |
| `phase` | `"dry"\|"wet"` | ✓ | Phase assignment for recipe |
| `state` | string | ✓ | Physical form: `"solid_flake"`, `"solid_powder"`, `"solid_noodle"`, `"solid_brittle"`, `"solid_waxy"`, `"liquid"`, `"paste"` |
| `surfactantType` | string | — | `"anionic"`, `"cationic"`, `"non-ionic"`, `"amphoteric"` (surfactants only) |
| `asm` | float | — | Active Surfactant Matter fraction, 0–1 (surfactants only) |
| `phContribution` | string | ✓ | `"very_basic"`, `"basic"`, `"mildly_basic"`, `"neutral"`, `"mildly_acidic"`, `"acidic"` |
| `phApprox` | float | ✓ | Approximate pH value (2–12) |
| `waterContent` | float | ✓ | Water fraction 0–1 (e.g., CAPB is 0.70 = 70% water) |
| `hardnessContribution` | float | ✓ | Bar hardness effect, -1 to +1 (negative = softens/weakens) |
| `latherProfile` | string | — | Lather character (surfactants only): `"creamy_velvety"`, `"fluffy_voluminous"`, `"abundant_rich"`, `"flash_foam"`, etc. |
| `minPct` | float | ✓ | Minimum safe percentage in formula |
| `maxPct` | float | ✓ | Maximum safe percentage in formula |
| `fixedPct` | float | — | If set, `balanceTo100()` won't scale this ingredient |
| `description` | string | ✓ | Human-readable description with source attribution |
| `processNote` | string | — | Manufacturing/process guidance |
| `substitutes` | string[] | ✓ | Array of ingredient IDs that can replace this one |
| `subNotes` | object | — | `{ ingredientId: "swap advice string" }` |
| `companions` | object[] | — | `[{ id, pct, reason }]` — auto-added when this ingredient enters formula |
| `incompatible` | string[] | — | Known incompatibilities |
| `tags` | string[] | ✓ | Searchable tags |

### Companion System

Certain ingredients need support ingredients for proper function. The `companions` field declares these:

```js
// SCS has pH 9.5 — needs acid
companions: [{ id: "citric_acid", pct: 0.15, reason: "SCS is pH 9.5 — needs acid..." }]
```

Ingredients with companions defined:

| Ingredient | Companion | Default % | Reason |
|---|---|---|---|
| SCS | Citric Acid | 0.15% | pH 9.5 |
| Decyl Glucoside | Citric Acid | 0.25% | pH 11–12 |
| Caprylyl Glucoside | Citric Acid | 0.15% | pH ~9.0 |
| BTMS-50 | Citric Acid | 0.20% | Cationic — deposits at pH 4–6 |
| BTMS-25 | Citric Acid | 0.20% | Same |
| Bentonite | Citric Acid | 0.15% | Alkaline clay (pH 8.5) |
| PQ-7 | Citric Acid | 0.10% | Cationic polymer |
| PQ-10 | Citric Acid | 0.10% | Cationic polymer |

### Lookup Map

```js
const ingredientMap = Object.fromEntries(INGREDIENTS.map(i => [i.id, i]));
```

O(1) lookups by ID. Used everywhere — validation, properties, UI rendering.

---

## 3. Data Model: Templates

### `TEMPLATES[]` — Recipe Templates

12 professional-source templates. Each is:

```js
{
  id: "simple_sulfate_free",
  name: "Simple Sulfate-Free",
  source: "Susan Barclay-Nichols",
  description: "Clean 3-surfactant bar. pH 5–6.",
  ingredients: [
    { id: "sci", pct: 45 },
    { id: "slsa", pct: 25 },
    // ...must sum to exactly 100
  ]
}
```

**CRITICAL: Template percentages must sum to exactly 100%.** The build script includes a verification check.

### Template List (v2.4)

| ID | Name | Source | Key Feature |
|---|---|---|---|
| `simple_sulfate_free` | Simple Sulfate-Free | Susan Barclay-Nichols | Clean 3-surfactant base |
| `conditioning_luxe` | Conditioning Luxe | Susan B-N | BTMS-50 + protein conditioning |
| `rice_starch_bar` | Rice Starch SCI+SLSa | Humble Bee & Me | Rice flour tradition |
| `charcoal_clarifying` | Charcoal Clarifying | Humble Bee & Me | Bentonite + activated charcoal |
| `ice_palace` | Ice Palace (SLSa-primary) | Humble Bee & Me | SLSa as primary surfactant |
| `moringa_temple` | Moringa Temple | Joan Morais | Moringa + baobab, non-ionic |
| `more_mango` | More Mango (75% Solid) | Marie Rayma | Extra hard, 75% solid surfactants |
| `french_green_clay` | French Green Clay | Marie Rayma 2020 | Non-ionic decyl glucoside blend |
| `creamy_french_2025` | Creamy French 2025 | Marie Rayma 2025 | Guar gum replaces carrageenan |
| `snowflake_conditioning` | Snowflake (SCI+SCS+BTMS-50) | Marie Rayma | True 2-in-1 shampoo+conditioner |
| `castor_rice` | Castor & Rice (Growth) | Composite | Castor oil + rice flour for growth |
| `ultra_gentle` | Ultra-Gentle (Sensitive Scalp) | Composite | Minimal surfactant load |

---

## 4. Data Model: Hair Goals

### `HAIR_GOALS[]` — Advisor System

7 goal types, each containing:

```js
{
  id: "bouncy_curls",
  label: "Bouncy Light Curls",
  emoji: "🌀",
  strategy: "Multi-paragraph strategy text...",
  keyIngredients: [
    { id: "hydrolyzed_rice_protein", why: "Strengthens curl structure...", essential: true },
    { id: "jojoba", why: "Lightweight oil...", essential: false },
  ],
  avoidIngredients: ["cocoa_butter", "shea_butter", "castor", "btms_50", "stearic_acid", "glycerin"],
  avoidReason: "Heavy butters and waxes weigh down curls",
  phGuidance: "pH 4.5–5.5 critical. High pH lifts cuticle → frizz.",
  proTips: ["Tip from source...", "..."],
  suggestedTemplate: "castor_rice",
}
```

### Goal Types

| ID | Label | Key Point |
|---|---|---|
| `bouncy_curls` | 🌀 Bouncy Light Curls | Lightweight, protein, pH critical |
| `max_conditioning` | 💧 Maximum Conditioning | BTMS-50, oils, protein |
| `two_in_one` | 🧴 2-in-1 Shampoo+Conditioner | Balanced BTMS-50 at 5–7% |
| `clarifying` | ✨ Clarifying / Deep Clean | Bentonite + charcoal, strong surfactants |
| `color_safe` | 🎨 Color-Safe / Gentle | No sulfates, low pH critical |
| `volume_fine` | 🌿 Volume for Fine Hair | Kaolin clay, no heavy oils |
| `oily_scalp` | 🫧 Oily Scalp / Frequent Wash | Strong surfactants, clay |

### Goal-Aware Validation

When a goal is active, the right panel checks:
1. **Avoided ingredients present** → warning with reason
2. **Missing essential ingredients** → notice suggesting addition

---

## 5. Formula State & Operations

### State Variables

```js
const [items, setItems]         = useState([]);      // [{ id, pct }] — the formula
const [selTemplate, setSelTemplate] = useState(null); // Active template ID
const [showAdd, setShowAdd]     = useState(false);    // Add ingredient panel open
const [search, setSearch]       = useState("");        // Ingredient search query
const [filterSlot, setFilterSlot] = useState("ALL");  // Category filter
const [selIng, setSelIng]       = useState(null);      // Selected ingredient ID (detail view)
const [batchSize, setBatchSize] = useState(100);       // Batch in grams
const [unit, setUnit]           = useState("g");       // Display unit
const [anchorId, setAnchorId]   = useState(null);      // Anchored ingredient ID
const [selGoal, setSelGoal]     = useState(null);      // Active goal ID
const [recipeName, setRecipeName] = useState("...");   // Recipe name
const [recipeNotes, setRecipeNotes] = useState("");    // User notes
const [savedRecipes, setSavedRecipes] = useState([]);  // In-memory saved recipes
const [showSaved, setShowSaved] = useState(false);     // Saved drawer open
const [showPrint, setShowPrint] = useState(false);     // Print view active
const [swapNotice, setSwapNotice] = useState(null);    // Smart swap notification
```

### Core Operations

| Function | What It Does |
|---|---|
| `loadTemplate(t)` | Replace items with template ingredients, reset goal |
| `addIng(id)` | Add ingredient + auto-add companions if missing |
| `removeIng(id)` | Remove ingredient, deselect if selected |
| `updatePct(id, v)` | Set ingredient percentage (min 0, 2 decimal places) |
| `updateWeight(id, w)` | Reverse-calculate batch size from a weight value |
| `toggleAnchor(id)` | Pin/unpin ingredient for weight-driven batch sizing |
| `smartSwap(oldId, newId)` | Replace ingredient + add companions + show notice |
| `balanceTo100()` | Scale all flexible ingredients to sum 100% |
| `resetFormula()` | Clear everything to blank state |
| `saveRecipe()` | Save current state to in-memory store |
| `loadSavedRecipe(r)` | Restore a saved recipe |
| `deleteSavedRecipe(id)` | Delete from saved store |

---

## 6. Validation Engine

`validateFormulation(items)` → `{ errors[], warnings[], info[] }`

Each message: `{ msg: string, sev: "error"|"warn"|"info", fixable?: "balance" }`

### Rules (in order)

1. **Total ≠ 100%** — Error if >0.5% off, warning if >0.05% off. Fixable by balance.
2. **Per-ingredient limits** — Error if any ingredient exceeds its `maxPct` or is below `minPct` (when > 0).
3. **Missing preservative** — Warning if any ingredient has `waterContent > 0` but no PRESERVATIVE-slot ingredient is present.
4. **Solid surfactant < 40%** — Warning. Bars may crumble or not hold shape.
5. **Dry phase outside 50–80%** — Warning. Too much dry = crumbly. Too much wet = soft/sticky.
6. **pH assessment** — Weighted average pH. Warning if outside 4.5–6.5 range.
7. **Oil > 15%** — Info. Can make bar feel greasy.
8. **Decyl glucoside present** — Warning about bar weakening (Chemists Corner finding).
9. **Glycerin > 3%** — Warning about stickiness.
10. **Starch + water** — Warning that starch feeds microbes, preservation must be robust.
11. **Needs-heat ingredients** — Info about hot-process method requirement (≥70°C).
12. **ASM > 70% or < 40%** — Warning/info about surfactant intensity.

---

## 7. Property Computation

`computeProperties(items)` → object with computed formula properties.

### Computed Properties

| Property | How It's Calculated |
|---|---|
| `totalASM` | Σ(ingredient.pct × ingredient.asm) for all surfactants |
| `topLather` | Lather profiles sorted by contribution, deduped |
| `surfTypes` | Unique surfactant types present (anionic, cationic, etc.) |
| `needsHeat` | true if any ingredient state is `solid_noodle`, `solid_brittle`, or `solid_waxy` |
| `phEst` | Weighted average pH: Σ(pct × phApprox) / Σ(pct) for ingredients with phApprox |
| `dryPct` | Total percentage of dry-phase ingredients |
| `wetPct` | Total percentage of wet-phase ingredients |
| `totalWater` | Σ(pct/100 × waterContent × 100) — actual water in formula |
| `method` | "Hot Process (melt ≥70°C)" or "Cold Press (no heat)" |

---

## 8. Smart Swap System

### Flow

```
User clicks "↔ Swap" on a substitution
  ↓
smartSwap(oldId, newId) called
  ↓
1. Get old ingredient's current pct
2. Clamp to new ingredient's maxPct
3. Check new ingredient's companions[]
4. Filter to companions NOT already in formula
5. Reduce new ingredient's pct by total companion pct
6. Replace old → new in items array
7. Append missing companions to items array
8. Show swapNotice banner (auto-dismiss 8s)
```

### Example

Swapping SLSa → Decyl Glucoside at 25%:
- Decyl glucoside maxPct = 15, so pct becomes 15
- Companion: citric_acid at 0.25% (not in formula)
- Final: decyl_glucoside at 14.75%, citric_acid at 0.25% added

---

## 9. Balance Algorithm

### Logic

```
1. Separate items into FIXED (has fixedPct, current ≈ fixedPct) and FLEX
2. fixedTotal = sum of FIXED items' pct
3. target = 100 - fixedTotal
4. scale = target / sum(FLEX items' pct)
5. Multiply each FLEX item's pct by scale
6. FIXED items unchanged
```

### Why Hold Fixed

Preservatives have `fixedPct` because they need to be at a specific concentration to be effective. Scaling a preservative below its minimum effective concentration creates a food-safety risk. Example: Germall Plus has `fixedPct: 0.4` — scaling it to 0.38% could compromise preservation.

---

## 10. Unit System & Anchor

### Units

```js
const UNITS = {
  g:  { factor: 1,          label: "grams" },
  oz: { factor: 0.035274,   label: "ounces" },
  lb: { factor: 0.00220462, label: "pounds" },
};
```

All internal calculations use grams. Display converts via `toUnit(grams, unit)`.

### Anchor Mechanism

Clicking ⚓ on an ingredient pins it. When the user types a weight value for that ingredient, the system reverse-calculates batch size:

```
batchSize = weightInGrams / (ingredient.pct / 100)
```

This lets formulators say "I have 50g of SCI" and have all other weights adjust automatically.

---

## 11. Print View

Activated by `showPrint = true`. Renders a separate layout optimized for `window.print()`.

### Features

- **Checkboxes on every ingredient** — tick off as you weigh. CSS-only strikethrough via `:checked + span { text-decoration: line-through; opacity: 0.5; }`
- **Phase separation** — Dry Phase (blue accent) and Wet Phase (amber accent) with subtotals
- **Auto-detected method** — checks ingredient `state` fields for `solid_noodle`, `solid_brittle`, `solid_waxy` → hot process; otherwise → cold press
- **Method steps** with checkboxes — tailored to hot/cold process
- **Properties summary** — ASM, dry:wet ratio, pH estimate, lather type
- **Validation warnings** — printed at bottom
- **Recipe notes** — if any

### Print CSS

```css
@media print {
  .no-print { display: none !important; }  /* Hides Back/Print buttons */
}
```

---

## 12. Recipe Persistence

### In-Memory Only

Recipes are stored in React state (`savedRecipes[]`). They persist for the browser session but are lost on page reload. This is intentional — the app was designed as a Claude Artifact where `localStorage` is not available.

### Recipe Object

```js
{
  id: "lq8xyz...",           // Date.now().toString(36)
  name: "My Custom Bar",
  notes: "Process notes...",
  items: [{ id, pct }, ...],
  batchSize: 100,
  unit: "g",
  selGoal: "bouncy_curls",
  savedAt: "2026-02-20T...",
}
```

### Future Enhancement

To add persistent storage, replace the `savedRecipes` state with `localStorage` read/write:

```js
// Load
const [savedRecipes, setSavedRecipes] = useState(() => {
  try { return JSON.parse(localStorage.getItem("syndet-recipes") || "[]"); }
  catch { return []; }
});

// Save effect
useEffect(() => {
  localStorage.setItem("syndet-recipes", JSON.stringify(savedRecipes));
}, [savedRecipes]);
```

---

## 13. UI Architecture

### Color System

```js
const C = {
  bg: "#ffffff",     // Main background
  s1: "#f8f9fa",     // Surface level 1 (headers, bars)
  s2: "#f0f2f5",     // Surface level 2 (drawers)
  s3: "#e8eaed",     // Surface level 3 (hover states)
  b1: "#dce0e5",     // Border primary
  b2: "#c4cad2",     // Border secondary
  t1: "#1a1d21",     // Text primary
  t2: "#4a5260",     // Text secondary
  t3: "#8892a0",     // Text tertiary
  acc: "#2e8b68",    // Accent (green)
  dry: "#3a6db5",    // Dry phase (blue)
  wet: "#b87a3a",    // Wet phase (amber)
  warn: "#b08520",   // Warning (amber)
  err: "#c03030",    // Error (red)
  info: "#3070b8",   // Info (blue)
  asm: "#9050b0",    // ASM indicator (purple)
  // + computed background variants (errBg, warnBg, etc.)
};
```

### Component Structure

The app is a single component (`SyndetFormulator`) with no sub-components. This is intentional — it keeps the single-file architecture simple and avoids the complexity of prop drilling or context providers.

If refactoring to multi-component:

```
SyndetFormulator (root)
├── Header (name, toolbar)
├── SavedDrawer (recipe list)
├── LeftPanel
│   ├── TemplateBar
│   ├── GoalBar + GoalDetail
│   ├── AddIngredientPanel
│   └── IngredientList (sortable rows)
├── RightPanel
│   ├── SwapNotice
│   ├── ValidationMessages
│   ├── GoalChecks
│   ├── IngredientDetail + Substitutions
│   ├── PhaseBreakdown
│   ├── PropertiesPanel
│   └── RecipeNotes
├── BottomBar (total, units, batch, add button)
└── PrintView (conditional)
```

---

## 14. Domain Knowledge Reference

### What Is a Syndet Bar?

A syndet (synthetic detergent) bar is a solid cleanser made from synthetic surfactants rather than saponified fats (traditional soap). Syndet bars have a lower pH (4.5–6.5 vs soap's 9–10), making them gentler on hair and skin.

### Key Chemistry Concepts

**Active Surfactant Matter (ASM)** — The fraction of a surfactant that actually cleanses. SCI flakes are ~85% active; CAPB liquid is ~30% active (rest is water). Total ASM of a formula determines cleansing intensity. Target: 40–70%.

**Phase System** — Dry phase = powders, flakes, solid butters. Wet phase = liquids, pastes. The dry:wet ratio determines bar hardness. Target: 50–80% dry.

**pH** — Must be 4.5–6.5 for hair. High pH (>7) lifts the cuticle → frizz, tangles, color loss. Some ingredients (SCS pH 9.5, Decyl Glucoside pH 11.5) need citric acid to bring pH down.

**Cationic Conditioning** — BTMS-50/25 are cationic (positive charge). They deposit on hair's negative charge during rinsing, providing slip and conditioning. Normally incompatible with anionic surfactants in water — but works in anhydrous syndet bars (confirmed by Chemists Corner).

**Hot Process vs Cold Press** — Cold press: mix powders + liquids, compress in mold. Hot process: melt solid ingredients (SCS noodles, BTMS-50, butters) at ≥70°C, combine with liquids, pour into molds, freeze for crystal formation.

### Common Pitfalls (from Professional Sources)

1. **Decyl glucoside weakens bars** — Chemists Corner tested 7 formulations at different percentages. Even 2% significantly weakens structural integrity.
2. **Don't add extra cetearyl alcohol with BTMS-50** — BTMS-50 is already 75% cetearyl alcohol (Chemists Corner).
3. **Glycerin > 3% makes bars sticky** — Use at 1–2% max in solid formats.
4. **Starch feeds microbes** — If using corn/rice/arrowroot starch with any water-containing ingredients, preservation must be robust (It's All In My Hands).
5. **SCS must be melted with liquid surfactant** — Unmelted SCS creates high-pH hot spots causing tangles (Marie/Humble Bee & Me).
6. **Freeze bars after molding with SCS** — Crystal formation during freezing creates the hard, shiny finish (Susan Barclay-Nichols).
