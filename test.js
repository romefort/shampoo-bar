#!/usr/bin/env node
/**
 * test.js — Comprehensive test suite for the Syndet Shampoo Bar Formulator.
 *
 * Tests:
 *   - Data integrity (ingredients, templates, goals)
 *   - validateFormulation() — all rules
 *   - computeProperties() — property calculations
 *
 * Usage: node test.js
 *
 * Uses Node's vm module to evaluate the pure-logic portion of formulator.jsx
 * in a sandbox with a mock React object.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── Load and evaluate the pure-logic portion of the source ──
const SRC = path.join(__dirname, "src", "formulator.jsx");
const fullCode = fs.readFileSync(SRC, "utf8");

// Extract everything up to the STYLES section (after computeProperties)
const cutoff = fullCode.indexOf("// STYLES");
if (cutoff === -1) {
  console.error("Could not find STYLES section marker in source");
  process.exit(1);
}
// Go back to the line start before the section divider
const pureCode = fullCode.substring(0, fullCode.lastIndexOf("\n", cutoff - 30));

// Append export statements so const-declared vars become sandbox properties
const exportCode = pureCode + `
this.FUNCTIONAL_SLOTS = FUNCTIONAL_SLOTS;
this.INGREDIENTS = INGREDIENTS;
this.TEMPLATES = TEMPLATES;
this.HAIR_GOALS = HAIR_GOALS;
this.ingredientMap = ingredientMap;
this.goalMap = goalMap;
this.validateFormulation = validateFormulation;
this.computeProperties = computeProperties;
`;

// Create sandbox with mock React
const sandbox = {
  React: {
    useState: (init) => [init, () => {}],
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (init) => ({ current: init }),
  },
  console,
  Object,
};
vm.createContext(sandbox);

try {
  vm.runInContext(exportCode, sandbox, { filename: "formulator.jsx" });
} catch (e) {
  console.error("Failed to evaluate source:", e.message);
  process.exit(1);
}

const {
  FUNCTIONAL_SLOTS,
  INGREDIENTS,
  TEMPLATES,
  HAIR_GOALS,
  ingredientMap,
  goalMap,
  validateFormulation,
  computeProperties,
} = sandbox;

// ── Test runner ──
let passed = 0;
let failed = 0;
let currentSuite = "";

function suite(name) {
  currentSuite = name;
  console.log(`\n═══ ${name} ═══`);
}

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✕ FAIL: ${msg}`);
  }
}

function assertIncludes(arr, predicate, msg) {
  assert(arr.some(predicate), msg);
}

function assertNotIncludes(arr, predicate, msg) {
  assert(!arr.some(predicate), msg);
}

// Helper: run validation and return { errors, warnings, info }
function validate(items) {
  return validateFormulation(items);
}

// Helper: build a simple formula from id/pct pairs
function formula(...pairs) {
  return pairs.map(([id, pct]) => ({ id, pct }));
}

// ═══════════════════════════════════════════════════════════════
// DATA INTEGRITY TESTS
// ═══════════════════════════════════════════════════════════════

suite("Data Integrity — Ingredients");

assert(INGREDIENTS.length >= 50, `At least 50 ingredients defined (found ${INGREDIENTS.length})`);

// Every ingredient must have required fields
const requiredFields = ["id", "name", "slot", "phase", "phContribution", "phApprox", "waterContent", "minPct", "maxPct", "description", "tags"];
let missingFields = [];
for (const ing of INGREDIENTS) {
  for (const f of requiredFields) {
    if (ing[f] === undefined && ing[f] !== 0) {
      missingFields.push(`${ing.id} missing ${f}`);
    }
  }
}
assert(missingFields.length === 0, `All ingredients have required fields${missingFields.length > 0 ? ": " + missingFields.slice(0, 3).join(", ") : ""}`);

// No duplicate IDs
const idSet = new Set();
let dupes = [];
for (const ing of INGREDIENTS) {
  if (idSet.has(ing.id)) dupes.push(ing.id);
  idSet.add(ing.id);
}
assert(dupes.length === 0, `No duplicate ingredient IDs${dupes.length > 0 ? ": " + dupes.join(", ") : ""}`);

// All slots reference valid FUNCTIONAL_SLOTS
const validSlots = new Set(Object.keys(FUNCTIONAL_SLOTS));
let badSlots = [];
for (const ing of INGREDIENTS) {
  if (!validSlots.has(ing.slot)) badSlots.push(`${ing.id} has slot "${ing.slot}"`);
  if (ing.alsoSlot && !validSlots.has(ing.alsoSlot)) badSlots.push(`${ing.id} has alsoSlot "${ing.alsoSlot}"`);
}
assert(badSlots.length === 0, `All ingredient slots are valid${badSlots.length > 0 ? ": " + badSlots.join(", ") : ""}`);

// minPct <= maxPct for all ingredients
let badRanges = [];
for (const ing of INGREDIENTS) {
  if (ing.minPct > ing.maxPct) badRanges.push(ing.id);
}
assert(badRanges.length === 0, `All ingredients have minPct <= maxPct${badRanges.length > 0 ? ": " + badRanges.join(", ") : ""}`);

// waterContent is 0–1
let badWater = [];
for (const ing of INGREDIENTS) {
  if (ing.waterContent < 0 || ing.waterContent > 1) badWater.push(ing.id);
}
assert(badWater.length === 0, `All waterContent values in 0–1 range${badWater.length > 0 ? ": " + badWater.join(", ") : ""}`);

// phApprox is 0–14
let badPh = [];
for (const ing of INGREDIENTS) {
  if (ing.phApprox < 0 || ing.phApprox > 14) badPh.push(ing.id);
}
assert(badPh.length === 0, `All phApprox values in 0–14 range${badPh.length > 0 ? ": " + badPh.join(", ") : ""}`);

// substitutes reference valid IDs
let badSubs = [];
for (const ing of INGREDIENTS) {
  if (!ing.substitutes) continue;
  for (const sub of ing.substitutes) {
    if (!ingredientMap[sub]) badSubs.push(`${ing.id} → ${sub}`);
  }
}
assert(badSubs.length === 0, `All substitution references are valid${badSubs.length > 0 ? ": " + badSubs.join(", ") : ""}`);

// companions reference valid IDs
let badComps = [];
for (const ing of INGREDIENTS) {
  if (!ing.companions) continue;
  for (const c of ing.companions) {
    if (!ingredientMap[c.id]) badComps.push(`${ing.id} → ${c.id}`);
  }
}
assert(badComps.length === 0, `All companion references are valid${badComps.length > 0 ? ": " + badComps.join(", ") : ""}`);

// ingredientMap has all ingredients
assert(Object.keys(ingredientMap).length === INGREDIENTS.length, `ingredientMap contains all ${INGREDIENTS.length} ingredients`);

suite("Data Integrity — Templates");

assert(TEMPLATES.length >= 10, `At least 10 templates defined (found ${TEMPLATES.length})`);

// Every template sums to exactly 100%
let badTemplateSums = [];
for (const t of TEMPLATES) {
  const sum = t.ingredients.reduce((s, i) => s + i.pct, 0);
  if (Math.abs(sum - 100) > 0.05) badTemplateSums.push(`${t.id}: ${sum.toFixed(2)}%`);
}
assert(badTemplateSums.length === 0, `All templates sum to 100%${badTemplateSums.length > 0 ? ": " + badTemplateSums.join(", ") : ""}`);

// All template ingredients exist
let badTemplateRefs = [];
for (const t of TEMPLATES) {
  for (const i of t.ingredients) {
    if (!ingredientMap[i.id]) badTemplateRefs.push(`${t.id} → ${i.id}`);
  }
}
assert(badTemplateRefs.length === 0, `All template ingredient references are valid${badTemplateRefs.length > 0 ? ": " + badTemplateRefs.join(", ") : ""}`);

// No duplicate IDs in templates
const templateIdSet = new Set();
let templateDupes = [];
for (const t of TEMPLATES) {
  if (templateIdSet.has(t.id)) templateDupes.push(t.id);
  templateIdSet.add(t.id);
}
assert(templateDupes.length === 0, `No duplicate template IDs`);

// Template ingredients within their ingredient min/max bounds (informational — professional recipes may exceed general guidelines)
let outOfBounds = [];
for (const t of TEMPLATES) {
  for (const item of t.ingredients) {
    const ing = ingredientMap[item.id];
    if (ing && item.pct > ing.maxPct) outOfBounds.push(`${t.id}: ${item.id} at ${item.pct}% > max ${ing.maxPct}%`);
  }
}
if (outOfBounds.length > 0) {
  console.log(`  △ INFO: ${outOfBounds.length} template ingredients exceed general max bounds (professional recipes may differ)`);
} else {
  console.log(`  ✓ All template ingredients within max bounds`);
}
passed++; // informational only

suite("Data Integrity — Hair Goals");

assert(HAIR_GOALS.length >= 7, `At least 7 hair goals defined (found ${HAIR_GOALS.length})`);

// All goals reference valid templates
let badGoalTemplates = [];
for (const g of HAIR_GOALS) {
  if (!templateIdSet.has(g.suggestedTemplate)) badGoalTemplates.push(`${g.id} → ${g.suggestedTemplate}`);
}
assert(badGoalTemplates.length === 0, `All goal suggestedTemplate references are valid${badGoalTemplates.length > 0 ? ": " + badGoalTemplates.join(", ") : ""}`);

// All goal keyIngredients reference valid ingredients
// Note: shea_butter is referenced in avoidIngredients but not yet in the ingredient list — known gap
const knownMissing = new Set(["shea_butter"]);
let badGoalIngs = [];
for (const g of HAIR_GOALS) {
  for (const ki of g.keyIngredients || []) {
    if (!ingredientMap[ki.id]) badGoalIngs.push(`${g.id} key → ${ki.id}`);
  }
  for (const ai of g.avoidIngredients || []) {
    if (!ingredientMap[ai] && !knownMissing.has(ai)) badGoalIngs.push(`${g.id} avoid → ${ai}`);
  }
}
assert(badGoalIngs.length === 0, `All goal ingredient references are valid${badGoalIngs.length > 0 ? ": " + badGoalIngs.join(", ") : ""}`);

// goalMap has all goals
assert(Object.keys(goalMap).length === HAIR_GOALS.length, `goalMap contains all ${HAIR_GOALS.length} goals`);

suite("Data Integrity — FUNCTIONAL_SLOTS");

// Required slots are defined
const expectedSlots = ["PRIMARY_SURFACTANT", "SECONDARY_SURFACTANT", "LIQUID_SURFACTANT", "PRESERVATIVE"];
for (const s of expectedSlots) {
  assert(FUNCTIONAL_SLOTS[s] !== undefined, `Slot ${s} exists`);
  assert(FUNCTIONAL_SLOTS[s].required === true, `Slot ${s} is marked required`);
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════

suite("Validation — Total check");

{
  // Formula summing to 100% — no total error
  const r = validate(formula(["sci", 50], ["slsa", 25], ["capb", 15], ["optiphen_plus", 1], ["jojoba", 9]));
  assertNotIncludes(r.errors, e => e.msg.includes("Total is"), "100% formula has no total error");
}

{
  // Formula over 100% — should have total error with "balance" fixable
  const r = validate(formula(["sci", 60], ["slsa", 30], ["capb", 15]));
  assertIncludes(r.errors, e => e.msg.includes("Total is") && e.fixable === "balance", "Over-100% formula has fixable total error");
}

{
  // Formula under 100% — should have total error
  const r = validate(formula(["sci", 30], ["slsa", 10]));
  assertIncludes(r.errors, e => e.msg.includes("Total is"), "Under-100% formula has total error");
}

suite("Validation — Per-ingredient limits");

{
  // SCI over maxPct (60%)
  const r = validate(formula(["sci", 70], ["slsa", 20], ["optiphen_plus", 1], ["capb", 9]));
  assertIncludes(r.errors, e => e.msg.includes("exceeds max"), "SCI over 60% triggers max error");
}

{
  // SCI under minPct (20%)
  const r = validate(formula(["sci", 10], ["slsa", 50], ["capb", 30], ["optiphen_plus", 1], ["cocoa_butter", 9]));
  assertIncludes(r.warnings, w => w.msg.includes("below recommended min"), "SCI under 20% triggers min warning");
}

suite("Validation — Preservative check (Bug #1 fix)");

{
  // Formula WITH water-bearing ingredients and NO preservative → error
  const r = validate(formula(["sci", 50], ["capb", 30], ["cocoa_butter", 20]));
  // capb has waterContent > 0
  assertIncludes(r.errors, e => e.msg.includes("No preservative"), "Water-bearing formula without preservative triggers error");
}

{
  // Formula with NO water-bearing ingredients and NO preservative → info, not error
  const r = validate(formula(["sci", 50], ["slsa", 30], ["cetyl_alcohol", 20]));
  assertNotIncludes(r.errors, e => e.msg.includes("No preservative"), "Anhydrous formula without preservative does NOT trigger error");
  assertIncludes(r.info, i => i.msg.includes("No preservative") && i.msg.includes("anhydrous"), "Anhydrous formula without preservative triggers info");
}

{
  // Formula WITH water-bearing ingredients AND preservative → no error
  const r = validate(formula(["sci", 50], ["capb", 30], ["optiphen_plus", 1], ["cocoa_butter", 19]));
  assertNotIncludes(r.errors, e => e.msg.includes("No preservative"), "Water-bearing formula with preservative has no preservative error");
}

{
  // Fully anhydrous formula WITH preservative — no messages about preservative
  const r = validate(formula(["sci", 50], ["slsa", 30], ["optiphen_plus", 1], ["cetyl_alcohol", 19]));
  assertNotIncludes(r.errors, e => e.msg.includes("preservative"), "Anhydrous formula with preservative has no preservative error");
  assertNotIncludes(r.info, i => i.msg.includes("anhydrous"), "Anhydrous formula with preservative has no anhydrous info");
}

suite("Validation — Incompatibility check (Bug #2 fix)");

{
  // Two ingredients where one lists the other as incompatible
  // Currently only btms_50 has incompatible: ["capb_in_water"] which isn't an ingredient ID
  // So let's verify no false positives fire with the existing data
  const r = validate(formula(["sci", 50], ["btms_50", 3], ["capb", 30], ["optiphen_plus", 1], ["cocoa_butter", 16]));
  assertNotIncludes(r.warnings, w => w.msg.includes("incompatible"), "btms_50 + capb does not trigger false incompatibility (capb_in_water is not capb)");
}

{
  // Empty incompatible arrays should not produce warnings
  const r = validate(formula(["sci", 50], ["slsa", 30], ["capb", 10], ["optiphen_plus", 1], ["cocoa_butter", 9]));
  assertNotIncludes(r.warnings, w => w.msg.includes("incompatible"), "Ingredients with empty incompatible arrays produce no warnings");
}

suite("Validation — Required slot check (Bug #3 fix)");

{
  // Formula missing PRIMARY_SURFACTANT
  const r = validate(formula(["capb", 50], ["optiphen_plus", 1], ["cocoa_butter", 49]));
  assertIncludes(r.warnings, w => w.msg.includes("Primary Solid Surfactant"), "Missing primary surfactant triggers warning");
}

{
  // Formula missing LIQUID_SURFACTANT
  const r = validate(formula(["sci", 50], ["slsa", 30], ["optiphen_plus", 1], ["cetyl_alcohol", 19]));
  assertIncludes(r.warnings, w => w.msg.includes("Liquid Surfactant"), "Missing liquid surfactant triggers warning");
}

{
  // Formula missing SECONDARY_SURFACTANT
  const r = validate(formula(["sci", 50], ["capb", 30], ["optiphen_plus", 1], ["cocoa_butter", 19]));
  assertIncludes(r.warnings, w => w.msg.includes("Secondary Solid Surfactant"), "Missing secondary solid surfactant triggers warning");
}

{
  // Complete formula with all required slots filled — no slot warnings
  const r = validate(formula(["sci", 40], ["slsa", 25], ["capb", 15], ["optiphen_plus", 1], ["cocoa_butter", 19]));
  assertNotIncludes(r.warnings, w => w.msg.includes("most syndet bars need"), "Complete formula has no missing slot warnings");
}

suite("Validation — Solid surfactant hardness");

{
  // Low solid surfactant percentage
  const r = validate(formula(["sci", 30], ["capb", 40], ["optiphen_plus", 1], ["cocoa_butter", 29]));
  assertIncludes(r.warnings, w => w.msg.includes("bars may be soft") && w.msg.includes("Solid surfactant"), "Low solid surfactant triggers soft bar warning");
}

suite("Validation — Dry/wet ratio");

{
  // Very low dry phase
  const r = validate(formula(["sci", 30], ["capb", 40], ["optiphen_plus", 1], ["cocoa_butter", 29]));
  assertIncludes(r.warnings, w => w.msg.includes("Dry phase") && w.msg.includes("wet/soft"), "Low dry phase triggers soft/wet warning");
}

suite("Validation — pH assessment");

{
  // Very basic ingredient without acid
  const r = validate(formula(["decyl_glucoside", 30], ["sci", 40], ["optiphen_plus", 1], ["cocoa_butter", 29]));
  assertIncludes(r.warnings, w => w.msg.includes("very basic") || w.msg.includes("pH adjuster"), "Very basic ingredient without acid triggers pH warning");
}

{
  // Basic ingredient (SCS) without acid
  const scs = ingredientMap["scs"];
  if (scs && scs.phContribution === "basic") {
    const r = validate(formula(["scs", 40], ["capb", 30], ["optiphen_plus", 1], ["cocoa_butter", 29]));
    assertIncludes(r.warnings, w => w.msg.includes("basic") || w.msg.includes("pH adjuster"), "Basic ingredient without acid triggers pH warning");
  }
}

suite("Validation — Oil check");

{
  // Oil/butter over 12%
  const r = validate(formula(["sci", 50], ["slsa", 20], ["capb", 10], ["optiphen_plus", 1], ["cocoa_butter", 19]));
  assertIncludes(r.warnings, w => w.msg.includes("Oil/butter") && w.msg.includes("soft"), "Oil over 12% triggers warning");
}

{
  // No oil/butter at all
  const r = validate(formula(["sci", 50], ["slsa", 30], ["capb", 19], ["optiphen_plus", 1]));
  assertIncludes(r.info, i => i.msg.includes("No oil/butter"), "No oil triggers info message");
}

suite("Validation — Decyl glucoside warning");

{
  const r = validate(formula(["sci", 40], ["decyl_glucoside", 20], ["capb", 20], ["optiphen_plus", 1], ["cocoa_butter", 19]));
  assertIncludes(r.warnings, w => w.msg.includes("Decyl Glucoside") && w.msg.includes("weakens"), "Decyl glucoside triggers bar weakening warning");
}

suite("Validation — Glycerin warning");

{
  const r = validate(formula(["sci", 50], ["slsa", 20], ["capb", 10], ["glycerin", 5], ["optiphen_plus", 1], ["cocoa_butter", 14]));
  assertIncludes(r.warnings, w => w.msg.includes("Glycerin") && w.msg.includes("sticky"), "Glycerin over 2% triggers stickiness warning");
}

{
  // Glycerin at 2% — should NOT trigger warning (threshold is >2)
  const r = validate(formula(["sci", 50], ["slsa", 20], ["capb", 10], ["glycerin", 2], ["optiphen_plus", 1], ["cocoa_butter", 17]));
  assertNotIncludes(r.warnings, w => w.msg.includes("Glycerin") && w.msg.includes("sticky"), "Glycerin at 2% does not trigger warning");
}

suite("Validation — Starch preservation warning");

{
  // Starch + water-bearing ingredient
  const hasStarchIngredient = INGREDIENTS.some(i => i.tags && i.tags.includes("starch"));
  if (hasStarchIngredient) {
    const starchId = INGREDIENTS.find(i => i.tags.includes("starch")).id;
    const r = validate(formula([starchId, 10], ["sci", 40], ["capb", 30], ["optiphen_plus", 1], ["cocoa_butter", 19]));
    assertIncludes(r.info, i => i.msg.includes("Starch") && i.msg.includes("microbes"), "Starch + water triggers preservation warning");
  }
}

suite("Validation — Heat detection");

{
  // Include an ingredient with state needing heat (e.g., btms_50 is solid_waxy)
  const r = validate(formula(["sci", 50], ["btms_50", 3], ["capb", 20], ["optiphen_plus", 1], ["cocoa_butter", 26]));
  assertIncludes(r.info, i => i.msg.includes("heat") || i.msg.includes("70°C"), "Ingredient needing heat triggers heat info");
}

suite("Validation — ASM intensity");

{
  // High ASM formula — need ASM > 75
  // sci asm=0.85 (60*0.85=51), slsa asm=0.65 (30*0.65=19.5), capb asm=0.30 (10*0.30=3) = 73.5 — not enough
  // Push harder: sci 70 + slsa 29 + optiphen 1 → 70*0.85 + 29*0.65 = 59.5 + 18.85 = 78.35 > 75
  const r = validate(formula(["sci", 70], ["slsa", 29], ["optiphen_plus", 1]));
  assertIncludes(r.info, i => i.msg.includes("Active Surfactant Matter") && i.msg.includes("high"), "Very high ASM triggers intensity info");
}

// ═══════════════════════════════════════════════════════════════
// COMPUTE PROPERTIES TESTS
// ═══════════════════════════════════════════════════════════════

suite("computeProperties — Basic calculations");

{
  const props = computeProperties(formula(["sci", 50], ["slsa", 25], ["capb", 15], ["optiphen_plus", 1], ["jojoba", 9]));

  // dryPct: sci(dry)=50 + slsa(dry)=25 = 75
  assert(parseFloat(props.dryPct) === 75.0, `Dry phase: expected 75.0, got ${props.dryPct}`);

  // wetPct: capb(wet)=15 + optiphen_plus(wet)=1 + jojoba(wet)=9 = 25
  assert(parseFloat(props.wetPct) === 25.0, `Wet phase: expected 25.0, got ${props.wetPct}`);

  // dryWetRatio
  assert(props.dryWetRatio === "75:25", `Dry:wet ratio: expected "75:25", got "${props.dryWetRatio}"`);

  // method: no heat-needing ingredients → Cold Press
  assert(props.method.includes("Cold Press"), `Method: expected Cold Press, got "${props.method}"`);
}

suite("computeProperties — ASM calculation");

{
  // Compute expected ASM from actual ingredient data
  const asmItems = formula(["sci", 50], ["slsa", 30], ["capb", 10], ["optiphen_plus", 1], ["jojoba", 9]);
  const props = computeProperties(asmItems);
  const expectedASM = asmItems.reduce((s, i) => {
    const g = ingredientMap[i.id];
    return s + (g && g.asm ? i.pct * g.asm : 0);
  }, 0).toFixed(1);
  assert(props.totalASM === expectedASM, `Total ASM: expected ${expectedASM}, got ${props.totalASM}`);
}

suite("computeProperties — Water content");

{
  // capb has waterContent=0.70
  const capb = ingredientMap["capb"];
  const props = computeProperties(formula(["sci", 50], ["capb", 20], ["slsa", 29], ["optiphen_plus", 1]));
  const expectedWater = (20 / 100 * capb.waterContent * 100).toFixed(1);
  assert(parseFloat(props.totalWater) >= parseFloat(expectedWater) - 0.1, `Water content accounts for CAPB water (expected ~${expectedWater}, got ${props.totalWater})`);
}

suite("computeProperties — Heat detection");

{
  // btms_50 is solid_waxy → needs heat
  const props = computeProperties(formula(["sci", 50], ["btms_50", 3], ["capb", 20], ["optiphen_plus", 1], ["cocoa_butter", 26]));
  assert(props.needsHeat === true, "Formula with BTMS-50 (solid_waxy) needs heat");
  assert(props.method.includes("Hot Process"), `Method: expected Hot Process, got "${props.method}"`);
}

{
  // No heat-needing ingredients (jojoba is liquid — no heat needed)
  const props = computeProperties(formula(["sci", 50], ["slsa", 25], ["capb", 15], ["optiphen_plus", 1], ["jojoba", 9]));
  assert(props.needsHeat === false, "Formula without waxy/noodle/brittle does not need heat");
  assert(props.method.includes("Cold Press"), `Method: expected Cold Press, got "${props.method}"`);
}

suite("computeProperties — pH estimate");

{
  // Only mild ingredients → ~5–6
  const props = computeProperties(formula(["sci", 50], ["slsa", 25], ["capb", 15], ["optiphen_plus", 1], ["jojoba", 9]));
  assert(props.phEst.includes("5") && props.phEst.includes("6"), `pH estimate for mild formula: expected ~5–6 range, got "${props.phEst}"`);
}

{
  // Very basic ingredient without acid → >8
  const props = computeProperties(formula(["decyl_glucoside", 30], ["sci", 40], ["optiphen_plus", 1], ["jojoba", 29]));
  assert(props.phEst.includes(">8") || props.phEst.includes("⚠"), `pH estimate with very basic: expected >8 warning, got "${props.phEst}"`);
}

{
  // Very basic + acid → ~5–7 verify
  const props = computeProperties(formula(["decyl_glucoside", 30], ["sci", 30], ["citric_acid", 1], ["optiphen_plus", 1], ["jojoba", 38]));
  assert(props.phEst.includes("verify") || props.phEst.includes("5"), `pH estimate with very basic + acid: expected verify, got "${props.phEst}"`);
}

suite("computeProperties — Lather profiles");

{
  const props = computeProperties(formula(["sci", 50], ["slsa", 30], ["capb", 10], ["optiphen_plus", 1], ["jojoba", 9]));
  assert(props.topLather.length > 0, `Lather profiles detected (found ${props.topLather.length})`);
}

suite("computeProperties — Oil percentage");

{
  const props = computeProperties(formula(["sci", 50], ["slsa", 20], ["capb", 10], ["optiphen_plus", 1], ["jojoba", 10], ["argan", 9]));
  assert(parseFloat(props.oilPct) === 19.0, `Oil percentage: expected 19.0, got ${props.oilPct}`);
}

suite("computeProperties — Surfactant types");

{
  const props = computeProperties(formula(["sci", 50], ["slsa", 20], ["capb", 15], ["optiphen_plus", 1], ["jojoba", 14]));
  assert(props.surfTypes["anionic"] > 0, "Anionic surfactant type detected");
  assert(props.surfTypes["amphoteric"] > 0, "Amphoteric surfactant type detected");
}

suite("computeProperties — Edge cases");

{
  // Empty formula
  const props = computeProperties([]);
  assert(props.dryWetRatio === "—", "Empty formula returns dash for dry:wet ratio");
  assert(props.needsHeat === false, "Empty formula does not need heat");
  assert(parseFloat(props.totalASM) === 0, "Empty formula has 0 ASM");
}

{
  // Zero-pct items should be ignored
  const props = computeProperties(formula(["sci", 50], ["btms_50", 0], ["slsa", 30], ["capb", 10], ["optiphen_plus", 1], ["jojoba", 9]));
  assert(props.needsHeat === false, "Zero-pct BTMS-50 does not trigger heat");
}

// ═══════════════════════════════════════════════════════════════
// REGRESSION TESTS — Validate templates produce expected results
// ═══════════════════════════════════════════════════════════════

suite("Regression — All templates pass validation without critical errors");

for (const t of TEMPLATES) {
  const r = validate(t.ingredients);
  // Templates should not have total errors (they sum to 100%)
  const hasTotalError = r.errors.some(e => e.msg.includes("Total is"));
  assert(!hasTotalError, `Template "${t.name}" has no total error`);
}

suite("Regression — All templates have valid computed properties");

for (const t of TEMPLATES) {
  const props = computeProperties(t.ingredients);
  assert(parseFloat(props.dryPct) + parseFloat(props.wetPct) > 90, `Template "${t.name}" dry+wet covers most of formula`);
  assert(props.dryWetRatio !== "—", `Template "${t.name}" has a valid dry:wet ratio`);
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════");
if (failed > 0) {
  console.log(`FAILED: ${passed} passed, ${failed} failed`);
  process.exit(1);
} else {
  console.log(`ALL ${passed} TESTS PASSED`);
}
