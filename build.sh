#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/src/formulator.jsx"
OUT="$SCRIPT_DIR/dist/formulator.html"

if [ ! -f "$SRC" ]; then
  echo "ERROR: Source file not found: $SRC"
  exit 1
fi

mkdir -p "$SCRIPT_DIR/dist"

# ── Write HTML shell + JSX → standalone HTML ──
cat > "$OUT" << 'HTMLTOP'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>◈ Syndet Bar Formulator</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #root { height: 100%; }
  body { background: #ffffff; overflow: hidden; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d0d4da; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #b0b6be; }
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type="number"] { -moz-appearance: textfield; }
  @media print {
    body { background: #fff !important; overflow: visible !important; }
    #root { height: auto !important; }
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js"></script>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
HTMLTOP

# Append JSX source
cat "$SRC" >> "$OUT"

# Append React mount + close tags
cat >> "$OUT" << 'HTMLBOTTOM'

ReactDOM.createRoot(document.getElementById("root")).render(<SyndetFormulator />);
</script>
</body>
</html>
HTMLBOTTOM

# ── Verify ──
LINES=$(wc -l < "$OUT")
SIZE=$(wc -c < "$OUT" | tr -d ' ')

echo "Built: $OUT"
echo "  Lines: $LINES"
echo "  Size:  $SIZE bytes ($(( SIZE / 1024 ))K)"

# Template sum verification
if command -v node &> /dev/null; then
  node -e "
    const fs = require('fs');
    const code = fs.readFileSync('$SRC', 'utf8');

    // Extract template ingredients and verify sums
    const templateRegex = /id:\s*\"([^\"]+)\",\s*name:\s*\"([^\"]+)\"[^}]*?ingredients:\s*\[([\s\S]*?)\]/g;
    let match;
    let allGood = true;
    while ((match = templateRegex.exec(code)) !== null) {
      const [, id, name, ingStr] = match;
      const pcts = [...ingStr.matchAll(/pct:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
      if (pcts.length === 0) continue;
      const sum = pcts.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.05) {
        console.log('  ✕ Template \"' + name + '\" sums to ' + sum.toFixed(2) + '% (should be 100%)');
        allGood = false;
      }
    }
    if (allGood) console.log('  ✓ All templates sum to 100%');

    // Ingredient count
    const ingCount = (code.match(/^\s*id:\s*\"/gm) || []).length;
    console.log('  ✓ ' + ingCount + ' ingredient definitions found');
  "
fi

echo "Done."
