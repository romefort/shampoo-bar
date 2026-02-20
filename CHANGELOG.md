# Changelog

## v2.4 — 2026-02-20

### Added
- **⟲ Reset button** — clears formula, template, goal, name, notes. Saved recipes preserved.
- **⚖ Balance to 100%** — proportionally scales all ingredients to sum 100%. Preservatives with `fixedPct` held at effective concentration. Button appears inline in validation messages and in bottom bar.
- **Smart Swap with companion auto-add** — swapping an ingredient now auto-adds required companions (e.g., citric acid for high-pH ingredients) at correct percentages. Green notification banner shows what was added and why.
- **Companion-aware Add** — adding new ingredients via the Add panel also triggers companion auto-add.
- **Companion data** on 8 ingredients: SCS, Decyl Glucoside, Caprylyl Glucoside, BTMS-50, BTMS-25, Bentonite, PQ-7, PQ-10.

### Improved
- Validation messages now explain *why* total must be 100% and show the difference (e.g., "4.0% over").
- Validation errors with auto-fix show an inline ⚖ Balance button.

### Fixed
- Scrolling in both panels — root container changed from `minHeight: "100vh"` to `height: "100vh"` so flex children properly constrain and overflow.

## v2.3 — 2026-02-20

### Added
- **6 new templates** (12 total): More Mango, French Green Clay, Creamy French 2025, Snowflake Conditioning, Castor & Rice, Ultra-Gentle.
- **Hair Goals Advisor** — 7 goal types with strategy, key ingredients, avoid lists, pH guidance, pro tips, and suggested template loading.
- **Goal-aware validation** — right panel shows warnings for avoided ingredients and notices for missing essentials.
- **Recipe naming** — editable inline field in header.
- **Recipe notes** — textarea in right panel for process notes and observations.
- **Recipe save/load/delete** — in-memory storage with saved recipes drawer.
- **Printable recipe page** — clean monospace layout with checkboxes, phase separation, auto-detected method, properties summary.

### Changed
- Switched from dark theme to light theme (white background, green accent).
- Goal advisor uses `#8856a8` purple for readability on white.
- Left panel restructured for unified scrolling.

## v2.2 — 2026-02-20

### Added
- **Weight-driven batch calculation** — type a weight for any ingredient, batch size auto-adjusts.
- **Unit selector** — grams, ounces, pounds with real-time conversion.
- **Anchor mechanism** — pin an ingredient to set batch size from its weight.

## v2.1 — 2026-02-20

### Added
- **50+ ingredients** with full metadata (pH, ASM, water content, hardness, lather profile).
- **6 initial templates** from Susan Barclay-Nichols, Humble Bee & Me, Joan Morais, Colonial Chemical.
- **Substitution system** with swap UI and compatibility notes.
- **Real-time validation** — 12+ validation rules.
- **Property computation** — ASM, lather profile, dry:wet ratio, pH estimate.
- **Phase visualization** — dry (blue) and wet (amber) breakdown.

## v1.0 — 2026-02-20

### Initial
- Basic syndet bar formulator with ingredient add/remove, percentage editing, and simple validation.
