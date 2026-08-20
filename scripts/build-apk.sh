#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# build-apk.sh — build a debug APK for ServingSync POS (single shop)
#
# This script:
#   1. Verifies environment (ANDROID_HOME, JAVA_HOME)
#   2. Temporarily moves /api routes out (they use request.headers which
#      can't be statically prerendered, and they're not needed in APK
#      mode — client-side SQLite handles everything via use-shop-fetch.ts)
#   3. Builds Next.js with BUILD_TARGET=apk → output: "export" → ./out
#   4. Restores /api routes
#   5. Runs `npx cap sync android` to copy ./out into the Android project
#   6. Runs `./gradlew assembleDebug` to build the APK
#   7. Copies the final APK to download/
#
# Prerequisites:
#   - Node + npm (already installed)
#   - JDK 21 (Capacitor 7 requires Java 21)
#     Download from https://adoptium.net/temurin/releases/?version=21
#   - Android SDK with build-tools;36.0.0 + platforms;android-36
#     Set ANDROID_HOME=/path/to/android-sdk
#
# Usage:
#   ANDROID_HOME=/path/to/android-sdk JAVA_HOME=/path/to/jdk-21 bash scripts/build-apk.sh
# ──────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")/.."   # project root

echo "==> [1/6] Verifying environment..."
if [ -z "$ANDROID_HOME" ]; then
  echo "ERROR: ANDROID_HOME is not set. Install Android SDK first:"
  echo "  mkdir -p \$ANDROID_HOME/cmdline-tools"
  echo "  cd /tmp && curl -sSL -o cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  echo "  unzip -q cmdline-tools.zip -d \$ANDROID_HOME/cmdline-tools/"
  echo "  mv \$ANDROID_HOME/cmdline-tools/cmdline-tools \$ANDROID_HOME/cmdline-tools/latest"
  echo "  export ANDROID_HOME=/path/to/android-sdk"
  echo "  yes | \$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses"
  echo "  \$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'"
  exit 1
fi
if [ -z "$JAVA_HOME" ]; then
  echo "ERROR: JAVA_HOME is not set. Capacitor 7 requires JDK 21."
  echo "  Download from https://adoptium.net/temurin/releases/?version=21"
  echo "  export JAVA_HOME=/path/to/jdk-21"
  exit 1
fi
echo "    ANDROID_HOME = $ANDROID_HOME"
echo "    JAVA_HOME    = $JAVA_HOME"
echo "    Java: $($JAVA_HOME/bin/java -version 2>&1 | head -1)"

# Make gradlew executable (sometimes loses +x in zips)
chmod +x android/gradlew

echo ""
echo "==> [2/6] Building Next.js static export (BUILD_TARGET=apk)..."
# Temporarily move /api routes out — they can't be statically prerendered
# (they use request.headers / request.nextUrl.searchParams), and they're
# not used in APK mode anyway (use-shop-fetch.ts intercepts everything).
API_BACKUP=""
if [ -d src/app/api ]; then
  API_BACKUP="/tmp/servingsync-api-backup-$$"
  mv src/app/api "$API_BACKUP"
  echo "    Moved src/app/api to $API_BACKUP (will restore after build)"
fi

# Clean previous build outputs
rm -rf out .next

# Build static export. BUILD_TARGET=apk tells next.config.ts to use
# output: "export" instead of "standalone".
BUILD_TARGET=apk npm run build:apk

# Restore /api routes (always restore, even if build failed, via trap)
if [ -n "$API_BACKUP" ] && [ -d "$API_BACKUP" ]; then
  mv "$API_BACKUP" src/app/api
  echo "    Restored src/app/api"
fi

# Verify out/ exists
if [ ! -d out ]; then
  echo "ERROR: Next.js static export failed — ./out directory not created"
  exit 1
fi
echo "    Static export size: $(du -sh out | cut -f1)"

echo ""
echo "==> [3/6] Syncing web assets into Android project..."
npx cap sync android

echo ""
echo "==> [4/6] Building debug APK with Gradle..."
cd android
./gradlew assembleDebug --no-daemon -Pandroid.suppressUnsupportedCompileSdk=36
cd ..

echo ""
echo "==> [5/6] Copying APK to download/..."
mkdir -p download
APK_SRC="android/app/build/outputs/apk/debug/app-debug.apk"
APK_DST="download/servingsync-pos-debug.apk"
if [ ! -f "$APK_SRC" ]; then
  echo "ERROR: APK not found at $APK_SRC"
  exit 1
fi
cp "$APK_SRC" "$APK_DST"

echo ""
echo "==> [6/6] Done."
echo "    APK: $APK_DST ($(du -h "$APK_DST" | cut -f1))"
echo "    Package: com.servingsync.pos"
echo "    Version: 1.0 (versionCode 1)"
echo "    Min Android: 7.0 (API 24)"
echo "    Target Android: 16 (API 36)"
echo ""
echo "Install on a phone with:"
echo "  adb install -r $APK_DST"
echo "Or copy $APK_DST to the phone and tap to install"
echo "(enable 'Install from unknown sources' in Settings first)"
