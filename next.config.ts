import type { NextConfig } from "next";

// ─── Build mode selection ──────────────────────────────────────────────
// - "standalone" → for Electron .exe and Node.js server deployments
// - "export"     → for Android APK (Capacitor) and static hosting
//
// Auto-detect: if BUILD_TARGET=apk is set, use export. Otherwise default
// to standalone (the original mode, safe for both Electron and dev).
const isApkBuild = process.env.BUILD_TARGET === "apk";

const nextConfig: NextConfig = {
  output: isApkBuild ? "export" : "standalone",
  // Static export doesn't support image optimization; turn it off when
  // building for APK so images are served as-is.
  ...(isApkBuild ? { images: { unoptimized: true } } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
