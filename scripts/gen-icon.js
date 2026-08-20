/**
 * Generate a Windows-compatible multi-resolution .ico file from public/logo.svg
 * Windows NSIS installers REQUIRE .ico format (SVG will silently fail).
 *
 * Output: public/logo.ico  (with embedded 16/32/48/64/128/256 PNG-encoded images)
 * Also outputs single PNGs: public/icon-16.png ... public/icon-512.png
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const projectRoot = path.resolve(__dirname, '..')
const svgPath = path.join(projectRoot, 'public', 'logo.svg')
const icoOut = path.join(projectRoot, 'public', 'logo.ico')

const SIZES = [16, 32, 48, 64, 128, 256]

async function main() {
  if (!fs.existsSync(svgPath)) {
    console.error(`[gen-icon] SVG not found: ${svgPath}`)
    process.exit(1)
  }

  console.log('[gen-icon] Rendering SVG to PNG buffers at sizes:', SIZES.join(', '))
  const pngBuffers = []
  for (const size of SIZES) {
    const png = await sharp(svgPath, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    pngBuffers.push({ size, png })
    // Also write the standalone PNG (handy for PWA manifest, favicon, etc.)
    const pngPath = path.join(projectRoot, 'public', `icon-${size}.png`)
    fs.writeFileSync(pngPath, png)
    console.log(`  ✓ ${size}x${size}  (${png.length} bytes)`)
  }

  // ── Assemble ICO file ──
  // ICO header: 6 bytes
  // ICONDIR entry: 16 bytes per image
  // PNG data: variable
  const headerSize = 6
  const dirEntrySize = 16
  const dirSize = dirEntrySize * pngBuffers.length
  let dataOffset = headerSize + dirSize
  let totalSize = headerSize + dirSize
  for (const { png } of pngBuffers) totalSize += png.length

  const buf = Buffer.alloc(totalSize)
  let p = 0

  // ICONDIR header
  buf.writeUInt16LE(0, p); p += 2      // reserved
  buf.writeUInt16LE(1, p); p += 2      // type = 1 (icon)
  buf.writeUInt16LE(pngBuffers.length, p); p += 2 // count

  // ICONDIRENTRY for each image (PNG-encoded, so width/height can be 0 for 256)
  for (const { size, png } of pngBuffers) {
    const w = size >= 256 ? 0 : size
    buf.writeUInt8(w, p); p += 1            // width
    buf.writeUInt8(w, p); p += 1            // height
    buf.writeUInt8(0, p); p += 1            // color count (0 = >=256 colors)
    buf.writeUInt8(0, p); p += 1            // reserved
    buf.writeUInt16LE(1, p); p += 2         // color planes
    buf.writeUInt16LE(32, p); p += 2        // bits per pixel
    buf.writeUInt32LE(png.length, p); p += 4  // image size
    buf.writeUInt32LE(dataOffset, p); p += 4  // image offset
    dataOffset += png.length
  }

  // PNG blobs
  for (const { png } of pngBuffers) {
    png.copy(buf, p)
    p += png.length
  }

  fs.writeFileSync(icoOut, buf)
  console.log(`[gen-icon] ✓ Wrote ICO: ${icoOut} (${buf.length} bytes)`)
}

main().catch((err) => {
  console.error('[gen-icon] FAILED:', err)
  process.exit(1)
})
