# Thuso — Build Guide

## Your License Keys

20 license keys have been generated. Each is valid for 365 days from activation.
See `download/license-keys.txt` for the full list.

**Super Admin Login:**
- Email: `super@thuso.com`
- Password: `admin123`

---

## Windows .exe Build

The .exe has been built in `release/win-unpacked/`. 

### To run on Windows:
1. Copy the entire `release/win-unpacked/` folder to a Windows computer
2. Double-click `Thuso.exe`
3. The app will:
   - Auto-create a local SQLite database in `%APPDATA%/Thuso/db/`
   - Ask for a license key (use one from license-keys.txt)
   - Open the login screen
   - Login with super@thuso.com / admin123

### To build a proper installer (.exe setup) on Windows:
1. Copy this entire project to a Windows computer
2. Double-click `build-exe.bat`
3. This will:
   - Install dependencies
   - Generate Prisma client
   - Build Next.js standalone
   - Create `Thuso Setup 1.0.0.exe` (NSIS installer)
4. The installer creates desktop + Start Menu shortcuts

### ⚠️ If you get "Failed to archive download files" error

This is the #1 most common electron-builder error on Windows. It happens because
electron-builder can't download `winCodeSign`, `nsis`, or the `electron` binary
from GitHub (which is slow or blocked in many regions, including India).

**Quick fix (do this first):**

1. Double-click `fix-build-cache.bat` — this manually downloads all the required
   binaries from a fast mirror (npmmirror.com) and places them in the correct
   cache location.
2. Then double-click `build-exe.bat` again — the build should now succeed because
   all binaries are already cached.

**If fix-build-cache.bat also fails (no internet to mirror):**

1. Manually download these 3 files from a machine with internet access:
   - https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z
   - https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z
   - https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-resources-3.4.1/nsis-resources-3.4.1.7z

2. Place them in these exact locations on your Windows machine:
   ```
   %LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0.7z
   %LOCALAPPDATA%\electron-builder\Cache\nsis\nsis-3.0.4.1.7z
   %LOCALAPPDATA%\electron-builder\Cache\nsis\nsis-resources\nsis-resources-3.4.1.7z
   ```
   (Type `%LOCALAPPDATA%` in File Explorer's address bar to find this folder.)

3. Also download the Electron binary:
   - https://github.com/electron/electron/releases/download/v33.4.11/electron-v33.4.11-win32-x64.zip
   - Place it at: `%LOCALAPPDATA%\electron\Cache\electron-v33.4.11-win32-x64.zip`

4. Run `build-exe.bat` again.

**Other possible causes of build failure:**

- **Antivirus blocking 7z extraction**: Temporarily disable your antivirus during
  the build, or add the project folder to exclusions.
- **Windows path too long**: Move the project to `C:\pos\` (short path) before building.
- **Code signing error**: The build config already has `signAndEditExecutable: false`
  so this should not happen. If it does, make sure you're using the latest
  `build-exe.bat`.
- **"Cannot find package.json"**: Run `build-exe.bat` from the project root, not
  from a subdirectory. The .bat file handles this automatically with `cd /d "%~dp0"`.

### Files in the .exe package:
```
release/win-unpacked/
├── Thuso.exe        ← Main app (double-click to run)
├── resources/
│   ├── app.asar               ← Electron main process
│   ├── standalone/            ← Next.js server (bundled)
│   │   ├── server.js
│   │   ├── public/            ← Background images, etc.
│   │   └── node_modules/
│   └── db-template/           ← Fresh database template
├── locales/                   ← Language packs
└── (Electron runtime files)
```

---

## Android APK Build

### Option 1: PWA (Easiest — no APK needed)

The app is a PWA (Progressive Web App). On Android:
1. Open Chrome on your Android phone
2. Go to your app URL (e.g. `http://your-server:3000`)
3. Tap the 3 dots menu → "Add to Home screen"
4. The app installs like a native app with its own icon
5. Works offline, full screen, no browser bar

### Option 2: Generate APK with PWABuilder

1. Deploy your app to a public URL (e.g. using Vercel, Netlify, or ngrok)
2. Go to https://www.pwabuilder.com
3. Enter your app URL
4. Click "Build My PWA" → select "Android"
5. Download the generated `.apk` file
6. Install on any Android device (enable "Install from unknown sources")

### Option 3: Generate APK with Bubblewrap (CLI)

```bash
# Install Bubblewrap CLI
npm install -g @bubblewrap/cli

# Initialize from your deployed PWA URL
bubblewrap init --manifest=https://your-app-url/manifest.json

# Build the APK
bubblewrap build

# The APK will be in app-release-signed.apk
```

### Option 4: Wrap with Capacitor (most control)

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android

# Initialize
npx cap init Thuso com.thuso.pos

# Build the web app
npm run build

# Add Android platform
npx cap add android

# Copy web assets
npx cap copy

# Open in Android Studio to build APK
npx cap open android
# In Android Studio: Build → Build APK
```

---

## Deploying to a Public URL (required for APK)

For the APK to work, your app needs to be accessible from a URL:

### Option A: Vercel (free)
```bash
npm install -g vercel
vercel
```

### Option B: ngrok (temporary tunnel)
```bash
ngrok http 3000
# Gives you a public URL like https://abc123.ngrok.io
```

### Option C: Your own server
Deploy the standalone build to any Node.js server:
```bash
NODE_ENV=production node .next/standalone/server.js
```

---

## Database

The app uses SQLite — a single file at `db/custom.db`.
- On Windows .exe: `%APPDATA%/Thuso/db/custom.db`
- On dev: `/home/z/my-project/db/custom.db`

The database is auto-created on first launch with:
- 1 sample shop (Spice Garden) — single-shop mode, shop picker is skipped
- 37 menu items
- 11 tables (10 + virtual Direct Counter)
- 1 super admin user
- 20 license keys

### Reset database:
```bash
rm db/custom.db
npx prisma db push
bun run scripts/seed-simple.ts
bun run scripts/seed-license.ts
```
