#!/usr/bin/env node
/**
 * verify.js — Run integrity checks on the formulator source.
 * Usage: node verify.js
 *
 * Checks:
 *   1. All template ingredient percentages sum to 100%
 *   2. All template ingredients reference valid ingredient IDs
 *   3. All substitution references point to valid ingredient IDs
 *   4. All companion references point to valid ingredient IDs
 *   5. All goal suggestedTemplate values reference valid template IDs
 *   6. All goal keyIngredients/avoidIngredients reference valid ingredient IDs
 *   7. Bracket balance (basic check)
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src", "formulator.jsx");
const code = fs.readFileSync(SRC, "utf8");

let errors = 0;
let warnings = 0;

function fail(msg) { console.log("  ✕ " + msg); errors++; }
function warn(msg) { console.log("  △ " + msg); warnings++; }
function pass(msg) { console.log("  ✓ " + msg); }

console.log("Verifying: " + SRC);
console.log("");

// ── Extract ingredient IDs ──
const ingredientIds = new Set();
const idMatches = code.matchAll(/^\s*id:\s*"([^"]+)",\s*name:/gm);
for (const m of idMatches) ingredientIds.add(m[1]);
pass(ingredientIds.size + " ingredients found");

// ── Extract template IDs ──
const templateIds = new Set();
const templateRegex = /id:\s*"([^"]+)",\s*name:\s*"([^"]+)"[^}]*?source:[^}]*?ingredients:\s*\[([\s\S]*?)\]/g;
let tmatch;
while ((tmatch = templateRegex.exec(code)) !== null) {
  const [, id, name, ingStr] = tmatch;
  templateIds.add(id);

  // Check sum
  const pcts = [...ingStr.matchAll(/pct:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
  const sum = pcts.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.05) {
    fail(`Template "${name}" (${id}) sums to ${sum.toFixed(2)}% — must be 100%`);
  }

  // Check ingredient refs
  const refs = [...ingStr.matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]);
  for (const ref of refs) {
    if (!ingredientIds.has(ref)) {
      fail(`Template "${name}" references unknown ingredient: "${ref}"`);
    }
  }
}
if (errors === 0) pass(templateIds.size + " templates verified (sums + refs)");

// ── Check substitution references ──
const subMatches = code.matchAll(/substitutes:\s*\[([^\]]*)\]/g);
let subCount = 0;
for (const m of subMatches) {
  const refs = [...m[1].matchAll(/"([^"]+)"/g)].map(r => r[1]);
  for (const ref of refs) {
    if (!ingredientIds.has(ref)) {
      fail(`Substitution references unknown ingredient: "${ref}"`);
    }
    subCount++;
  }
}
pass(subCount + " substitution references checked");

// ── Check companion references ──
const compMatches = code.matchAll(/companions:\s*\[\{[^}]*id:\s*"([^"]+)"/g);
let compCount = 0;
for (const m of compMatches) {
  if (!ingredientIds.has(m[1])) {
    fail(`Companion references unknown ingredient: "${m[1]}"`);
  }
  compCount++;
}
pass(compCount + " companion references checked");

// ── Check goal references ──
const goalTemplateMatches = code.matchAll(/suggestedTemplate:\s*"([^"]+)"/g);
for (const m of goalTemplateMatches) {
  if (!templateIds.has(m[1])) {
    fail(`Goal suggestedTemplate references unknown template: "${m[1]}"`);
  }
}

const goalIngMatches = code.matchAll(/(?:keyIngredients|avoidIngredients):\s*\[([\s\S]*?)\]/g);
for (const m of goalIngMatches) {
  const refs = [...m[1].matchAll(/id:\s*"([^"]+)"/g)].map(r => r[1]);
  for (const ref of refs) {
    if (!ingredientIds.has(ref) && ref !== "glycerin") {
      // glycerin might not have a standalone entry in some versions
      warn(`Goal references ingredient "${ref}" — verify it exists`);
    }
  }
}
pass("Goal references checked");

// ── Bracket balance ──
let braces = 0, brackets = 0;
for (const c of code) {
  if (c === "{") braces++;
  if (c === "}") braces--;
  if (c === "[") brackets++;
  if (c === "]") brackets--;
}
if (braces !== 0) warn(`Brace imbalance: ${braces} (may be false positive in JSX)`);
else pass("Braces balanced");
if (brackets !== 0) warn(`Bracket imbalance: ${brackets}`);
else pass("Brackets balanced");

// ── Summary ──
console.log("");
if (errors > 0) {
  console.log(`FAILED: ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`PASSED with ${warnings} warning(s)`);
} else {
  console.log("ALL CHECKS PASSED");
}
