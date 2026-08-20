#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# build-exe.sh — build a desktop app for ServingSync POS (single shop)
#
# Picks the right target based on the OS you're running on:
#   • Linux  → AppImage  (no wine needed)
#   • Windows → NSIS .exe installer (uses native Windows toolchain)
#   • macOS  → .dmg
#
# To cross-build a Windows .exe on Linux, install wine64 first:
#   sudo apt-get install -y wine64
#   bash scripts/build-exe.sh --win
#
# Prerequisites:
#   - Node + npm (already installed)
#   - The Next.js standalone build at .next/standalone/ (this script
#     will build it if missing)
#
# Usage:
#   bash scripts/build-exe.sh              # auto-detect host OS
#   bash scripts/build-exe.sh --win        # force Windows .exe (needs wine on Linux)
#   bash scripts/build-exe.sh --linux      # force Linux AppImage
#   bash scripts/build-exe.sh --mac        # force macOS .dmg
# ──────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")/.."   # project root

# Parse args
TARGET=""
case "${1:-}" in
  --win)   TARGET="--win" ;;
  --linux) TARGET="--linux" ;;
  --mac)   TARGET="--mac" ;;
  *)       TARGET="" ;;  # auto-detect
esac

echo "==> [1/4] Building Next.js standalone (output: standalone)..."
# Always rebuild standalone so the .exe bundles the latest code
rm -rf .next out
npm run build:standalone

# Verify standalone exists
if [ ! -f .next/standalone/server.js ]; then
  echo "ERROR: Next.js standalone build failed — .next/standalone/server.js not found"
  exit 1
fi
echo "    Standalone size: $(du -sh .next/standalone | cut -f1)"

echo ""
echo "==> [2/4] Verifying electron / electron-builder..."
# electron-builder needs the electron binary in node_modules/electron/dist
if [ ! -d node_modules/electron/dist ]; then
  echo "    Installing electron..."
  npm install electron --no-save
fi
if [ ! -d node_modules/electron-builder ]; then
  echo "    Installing electron-builder..."
  npm install electron-builder --no-save
fi
echo "    electron: $(node -p "require('electron/package.json').version")"
echo "    electron-builder: $(node -p "require('electron-builder/package.json').version")"

echo ""
echo "==> [3/4] Building desktop app with electron-builder..."
if [ -n "$TARGET" ]; then
  echo "    Target: $TARGET (forced)"
else
  echo "    Target: auto (will pick based on host OS)"
fi
# electron-builder reads the "build" field from package.json automatically.
# No --config flag needed.
npx electron-builder $TARGET

echo ""
echo "==> [4/4] Copying output to download/..."
mkdir -p download

# Find the built artifact(s) and copy them to download/
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*|*Windows*)
    # Windows .exe installer
    for f in release/*Setup*.exe release/*.exe; do
      [ -f "$f" ] || continue
      cp "$f" download/$(basename "$f")
      echo "    ✓ $(basename "$f")"
    done
    ;;
  Darwin)
    for f in release/*.dmg release/*.app; do
      [ -f "$f" ] || [ -d "$f" ] || continue
      cp -r "$f" download/
      echo "    ✓ $(basename "$f")"
    done
    ;;
  *)
    # Linux AppImage
    for f in release/*.AppImage; do
      [ -f "$f" ] || continue
      cp "$f" download/$(basename "$f")
      chmod +x download/$(basename "$f")
      echo "    ✓ $(basename "$f")"
    done
    # Also pick up Windows .exe if cross-built with --win
    for f in release/*Setup*.exe release/*.exe; do
      [ -f "$f" ] || continue
      cp "$f" download/$(basename "$f")
      echo "    ✓ $(basename "$f")"
    done
    ;;
esac

echo ""
echo "=== DONE ==="
echo "Artifacts in download/:"
ls -lh download/*.AppImage download/*.exe download/*.dmg 2>/dev/null || echo "  (no artifacts found — check release/ folder)"
echo ""
echo "To run on Linux:    ./download/Thuso-*.AppImage"
echo "To install on Win:  double-click download/Thuso-Setup-*.exe"
echo "To install on Mac:  double-click download/Thuso-*.dmg"
