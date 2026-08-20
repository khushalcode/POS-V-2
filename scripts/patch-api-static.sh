#!/usr/bin/env bash
# Marks every API route as force-static so Next.js can build a static
# export for Capacitor. The /api/* routes are not used in APK mode
# (use-shop-fetch.ts routes everything to client-side SQLite), but
# Next.js still needs them to compile so the build doesn't fail.
set -e

cd "$(dirname "$0")/.."

echo "Patching API routes for static export..."

# Find every route.ts under src/app/api
find src/app/api -name "route.ts" -type f | while read -r f; do
  # Skip if already patched
  if grep -q 'export const dynamic = "force-static"' "$f"; then
    echo "  [skip] $f (already patched)"
    continue
  fi
  # Insert the marker at the top, after the imports. We do this by
  # finding the last import line and appending after it.
  python3 - "$f" <<'PY'
import sys, re
path = sys.argv[1]
with open(path) as fh: src = fh.read()
# Find end of last import / top-of-file marker
marker = '\nexport const dynamic = "force-static"\n// Static export marker — APK build. Not used at runtime in APK mode (client-side SQLite).\n'
# Insert before the first export async function
m = re.search(r'^export async function', src, re.M)
if m:
    src = src[:m.start()] + marker + src[m.start():]
else:
    src = src + marker
with open(path, 'w') as fh: fh.write(src)
PY
  echo "  [patched] $f"
done

echo "Done. ${#files[@]} files processed."
