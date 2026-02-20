# ◈ Syndet Shampoo Bar Formulator

A professional-grade web tool for designing solid syndet (synthetic detergent) shampoo bar recipes. Built for cosmetic formulators, soap makers, and DIY hair care enthusiasts.

## Features

**Formula Builder** — Add ingredients from a curated database of 50+ professional-grade cosmetic raw materials. Each ingredient carries metadata about pH, active surfactant matter, water content, hardness contribution, lather profile, and safe usage ranges.

**12 Professional Templates** — Start from proven formulations by Marie Rayma (Humblebee & Me), Susan Barclay-Nichols (Swift Crafty Monkey), Chemists Corner, Joan Morais, and Colonial Chemical. Every template sums to exactly 100%.

**Hair Goals Advisor** — Select a goal (Bouncy Curls, Maximum Conditioning, Clarifying, Color-Safe, Volume, Oily Scalp, 2-in-1) and get ingredient recommendations, things to avoid, pH guidance, and suggested templates. Goal-aware validation warns when your formula contradicts your goal.

**Real-Time Validation** — Checks total percentage, per-ingredient limits, preservative presence, surfactant hardness, dry:wet ratio, pH assessment, ASM intensity, and ingredient-specific warnings (decyl glucoside weakening, glycerin stickiness, starch preservation).

**Smart Swap** — Swap any ingredient for a substitute. The system automatically adds companion ingredients (like citric acid for pH-sensitive swaps) at correct percentages.

**⚖ Auto-Balance** — One click proportionally scales all ingredients to hit exactly 100%, holding preservatives at their effective concentrations.

**Weight-Driven Batch Calculation** — Set batch size in grams, ounces, or pounds. Anchor any ingredient to reverse-calculate batch size from a known weight.

**Printable Recipe Page** — Clean monospace layout with checkboxes for each ingredient (tick off as you weigh), auto-detected method (hot-press vs cold-press), phase separation (dry/wet), and properties summary.

**Recipe Save/Load** — Name and save recipes in-session. Load and compare multiple formulations.

## Quick Start

Open `dist/formulator.html` in any modern browser. No installation, no server, no internet required (after first load for font CDN).

Or build from source:

```bash
./build.sh
open dist/formulator.html
```

## Technology

Single-page React app compiled in-browser via Babel Standalone. Zero dependencies, zero build tooling. The entire application is one HTML file.

- React 18.2.0 (CDN)
- Babel Standalone 7.23.9 (CDN)
- IBM Plex Sans + Mono (Google Fonts)

## Project Structure

```
├── CLAUDE.md           # Claude Code development guide
├── ARCHITECTURE.md     # Deep technical documentation
├── CHANGELOG.md        # Version history
├── build.sh            # JSX → standalone HTML
├── src/
│   └── formulator.jsx  # All source code (~2100 lines)
└── dist/
    └── formulator.html # Built output (open in browser)
```

## Sources

Formulation data, ingredient properties, and professional guidance from:

- **Marie Rayma** — Humblebee & Me (templates, substitution chemistry)
- **Susan Barclay-Nichols** — Swift Crafty Monkey / Point of Interest (base formula, process science)
- **Chemists Corner** — Perry Romanowski (compatibility testing, decyl glucoside trials)
- **Joan Morais** — Professional manufacturing notes
- **Colonial Chemical** — Starch-based formulations
- **It's All In My Hands** — Preservation warnings
- **Ajinomoto** — SCI surfactant technical guidelines

## Version

v2.4 — February 2026

## License

Personal/educational use. Formulation data is compiled from publicly available professional sources cited above.
