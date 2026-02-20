# CLAUDE.md — Syndet Shampoo Bar Formulator

## What This Is

A professional-grade syndet (synthetic detergent) shampoo bar formulator built as a single-page React app. It helps formulators design solid shampoo bar recipes with real-time validation, 50+ ingredients, 12 templates, and a hair goals advisor.

The app runs entirely client-side — no backend, no database, no API. It's a single HTML file that loads React 18 + Babel from CDN and compiles JSX in-browser.

## Project Structure

```
shampoo-bar/
├── CLAUDE.md              ← You are here
├── README.md              ← Project overview for humans
├── ARCHITECTURE.md        ← Deep technical documentation
├── CHANGELOG.md           ← Version history
├── package.json           ← Metadata only (no npm build)
├── build.sh               ← Wraps src JSX → dist HTML
├── src/
│   └── formulator.jsx     ← THE canonical source file (all logic + UI)
└── dist/
    └── formulator.html    ← Built output (standalone, deployable)
```

## How to Build

```bash
./build.sh
# Produces dist/formulator.html — open in any browser, no server needed
```

The build script wraps `src/formulator.jsx` in an HTML shell with CDN script tags. That's the entire build process.

## How to Edit

**All code lives in `src/formulator.jsx`** (~2100 lines). It's one file by design — the app ships as a single HTML file, so keeping the source monolithic avoids module bundler complexity.

The file has clearly marked sections:

| Line Range | Section | What It Contains |
|---|---|---|
| 1–25 | Setup | React destructuring, FUNCTIONAL_SLOTS (ingredient categories) |
| 26–697 | INGREDIENTS[] | 50+ ingredients with full metadata |
| 698–825 | TEMPLATES[] | 12 recipe templates from professional sources |
| 826–1018 | HAIR_GOALS[] | 7 hair goal types with advisor data |
| 1019 | Lookup maps | `goalMap`, `ingredientMap` — O(1) lookups by ID |
| 1025–1106 | validateFormulation() | All validation rules (total, pH, ASM, etc.) |
| 1107–1149 | computeProperties() | Property calculator (ASM, lather, dry:wet, etc.) |
| 1153–1174 | Theme + Units | Color palette (C), unit definitions, conversion |
| 1176–end | SyndetFormulator() | Main React component — state, handlers, render |

## Key Concepts

### Ingredient Model

Every ingredient is an object with these fields:

```js
{
  id: "sci",                          // Unique key
  name: "SCI (Sodium Cocoyl Isethionate)",
  slot: "PRIMARY_SURFACTANT",         // Functional category
  alsoSlot: "SECONDARY_SURFACTANT",   // Optional secondary category
  phase: "dry",                       // "dry" or "wet"
  state: "solid_flake",              // Physical form (affects process method)
  surfactantType: "anionic",          // anionic/cationic/non-ionic/amphoteric
  asm: 0.85,                          // Active Surfactant Matter (0–1)
  phContribution: "mildly_acidic",    // pH behavior
  phApprox: 5.5,                      // Approximate pH value
  waterContent: 0,                    // Fraction water (0–1)
  hardnessContribution: 0.8,          // Bar hardness effect (-1 to +1)
  latherProfile: "creamy_velvety",    // Lather character
  minPct: 20, maxPct: 60,            // Safe percentage range
  fixedPct: null,                     // If set, balance() holds this value
  description: "...",                 // Human-readable description
  processNote: "...",                 // Manufacturing guidance
  substitutes: ["slsa", "scs"],       // Swappable alternatives
  subNotes: { slsa: "..." },          // Swap-specific advice
  companions: [{ id: "citric_acid", pct: 0.25, reason: "..." }],  // Auto-added on swap
  incompatible: [],                   // Known conflicts
  tags: ["sulfate-free"],             // Searchable tags
}
```

Not all fields are present on all ingredients. `asm`, `surfactantType`, `latherProfile` only exist on surfactants. `companions` only on ingredients that need pH adjustment or other support ingredients.

### Formula Model

A recipe is an array of `{ id, pct }` objects. Percentages must sum to 100 (they represent weight% of the final bar).

```js
items = [
  { id: "sci", pct: 45 },
  { id: "slsa", pct: 25 },
  { id: "capb", pct: 10 },
  // ...must total 100%
]
```

### Validation System

`validateFormulation(items)` returns `{ errors, warnings, info }` — each an array of `{ msg, sev, fixable? }`. Rules include:

- **Total must be 100%** (fixable: "balance" → triggers proportional scaling)
- **Per-ingredient min/max** (e.g., SCI must be 20–60%)
- **Preservative required** if water content > 0
- **Solid surfactant ≥ 40%** for bar hardness
- **Dry phase 50–80%** recommended
- **pH assessment** from weighted average of ingredient pH values
- **Oil/butter limits** (>15% can make bar greasy)
- **Specific warnings**: decyl glucoside weakens bars, glycerin > 3% causes stickiness, starch needs extra preservation
- **ASM check**: Active Surfactant Matter should be 40–70% for effective cleansing
- **Heat detection**: ingredients tagged `needs-melting` trigger hot-process method

### Smart Swap System

When swapping ingredient A for ingredient B:
1. B gets A's percentage (clamped to B's maxPct)
2. If B has `companions[]`, missing companions are auto-added
3. B's percentage is reduced by the total companion percentage to keep formula balanced
4. A green "Smart Swap" banner shows what was added and why
5. Same logic fires when adding new ingredients via the Add panel

### Balance Algorithm

`balanceTo100()` proportionally scales all ingredients except those with `fixedPct` (preservatives). This means a formula at 104% has all flexible ingredients scaled down by ~4%, while preservatives stay at effective concentrations.

### Hair Goals Advisor

Each goal (e.g., "Bouncy Light Curls") contains:
- `keyIngredients[]` with `{ id, why, essential }` — what to include
- `avoidIngredients[]` — what to avoid
- `avoidReason` — why to avoid them
- `suggestedTemplate` — best template to start from
- Strategy text, pH guidance, pro tips

When a goal is active, the right panel shows goal-aware validation:
- ⚠ Warnings for avoided ingredients present in formula
- ○ Notices for missing essential ingredients

### Templates

12 professional-source templates from Marie Rayma, Humble Bee & Me, Susan Barclay-Nichols, Chemists Corner, Joan Morais, and Colonial Chemical. All verified to sum to exactly 100%.

### Units & Batch

Internal unit is always grams. `toUnit(g, unit)` and `fromUnit(val, unit)` convert. Anchor system: clicking ⚓ on an ingredient pins it — typing a weight value recalculates batch size from that weight.

## Common Tasks

### Adding a New Ingredient

Add an object to the `INGREDIENTS[]` array. Required fields: `id`, `name`, `slot`, `phase`, `state`, `phContribution`, `phApprox`, `waterContent`, `hardnessContribution`, `minPct`, `maxPct`, `description`, `substitutes`, `tags`. See existing ingredients for patterns.

### Adding a New Template

Add to `TEMPLATES[]`. Must have `id`, `name`, `source`, `description`, `ingredients[]`. **The ingredient percentages must sum to exactly 100%.** Run `build.sh` to verify.

### Adding a New Hair Goal

Add to `HAIR_GOALS[]`. Must have `id`, `label`, `emoji`, `strategy`, `keyIngredients[]`, `avoidIngredients[]`, `avoidReason`, `phGuidance`, `proTips[]`, `suggestedTemplate`. The `suggestedTemplate` must match a template `id`.

### Adding a New Validation Rule

Add to `validateFormulation()`. Push to `errors[]`, `warnings[]`, or `info[]`. If it's fixable by balance, add `fixable: "balance"`.

## Technology

- React 18.2.0 (CDN)
- Babel Standalone 7.23.9 (CDN, in-browser JSX compilation)
- IBM Plex Sans + Mono (Google Fonts CDN)
- No npm dependencies, no build tooling, no bundler
- All state in React `useState` — no external state management
- Session-only recipe storage (no localStorage by design)

## Sources / Domain Knowledge

The formulation data comes from these professional sources:
- **Marie Rayma** (Humblebee & Me) — most templates, substitution notes
- **Susan Barclay-Nichols** (Swift Crafty Monkey / Point of Interest) — base formula, process notes
- **Chemists Corner** — BTMS-50/anionic compatibility, decyl glucoside findings
- **Joan Morais** — Moringa + Baobab temple, professional manufacturing notes
- **Colonial Chemical** — corn starch formulations
- **It's All In My Hands** — starch preservation warnings
- **Ajinomoto** — Professional SCI surfactant guidelines

## Known Limitations

- No localStorage (recipes lost on reload) — intentional for Artifact compatibility
- pH calculation is approximate (weighted average, not actual titration)
- ASM is theoretical (doesn't account for synergy effects)
- Single-file architecture limits IDE features like auto-import
- Babel standalone compilation is slower than pre-compiled bundles

## Style Guidelines

- Light theme, IBM Plex fonts
- Compact UI (fontSize 9–13px)
- Color accent: `#2e8b68` (green)
- Dry phase: blue (`#3a6db5`), Wet phase: amber (`#b87a3a`)
- Validation: red (error), amber (warning), blue (info)
- No emojis in code comments, only in UI labels
