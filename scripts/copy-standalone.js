/**
 * Cross-platform copy of .next/static and public/ into .next/standalone/
 * (replacement for the Unix-only `cp -r` used in the old build script)
 *
 * Works on Windows, macOS and Linux — no external deps required.
 */
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-standalone] SKIP (missing): ${src}`)
    return
  }
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
  }
}

console.log('[copy-standalone] Copying .next/static -> .next/standalone/.next/static')
copyRecursive(
  path.join(projectRoot, '.next', 'static'),
  path.join(projectRoot, '.next', 'standalone', '.next', 'static')
)

console.log('[copy-standalone] Copying public -> .next/standalone/public')
copyRecursive(
  path.join(projectRoot, 'public'),
  path.join(projectRoot, '.next', 'standalone', 'public')
)

console.log('[copy-standalone] Done.')
