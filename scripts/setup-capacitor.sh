#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# setup-capacitor.sh — one-time setup to enable Android APK builds
# Run this locally, then commit the results to your repo.
# ─────────────────────────────────────────────────────────────
set -e

cd "$(dirname "$0")/.."   # project root

echo "==> Installing Capacitor packages..."
npm install @capacitor/core @capacitor/cli @capacitor/android

echo "==> Switching Next.js to static export mode..."
# Replace `output: "standalone"` with `output: "export"`
sed -i.bak 's/output: "standalone"/output: "export"/' next.config.ts
rm -f next.config.ts.bak

echo "==> Initializing Capacitor (webDir = out)..."
npx cap init ServingSyncPOS com.servingsync.pos --web-dir=out

echo "==> Adding Android platform..."
npx cap add android

echo "==> Done. Now run a test build locally:"
echo "    npx next build && npx cap sync android && cd android && ./gradlew assembleDebug"

echo ""
echo "==> Commit these files to your repo:"
echo "    git add android/ capacitor.config.ts next.config.ts package.json package-lock.json"
echo "    git commit -m 'Add Capacitor for Android APK builds'"
echo "    git push"
echo ""
echo "==> Then push a tag to trigger the GitHub Actions release workflow:"
echo "    git tag v1.0.0 && git push origin v1.0.0"
