const fs = require('fs')
const path = require('path')

exports.default = async function (context) {
  const { appOutDir } = context
  const src = path.join(__dirname, '..', '.next', 'standalone', 'node_modules')
  const dest = path.join(appOutDir, 'resources', 'standalone', 'node_modules')

  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true })
    console.log(`[afterPack] Copied node_modules -> ${dest}`)
  } else {
    console.warn(`[afterPack] WARNING: source node_modules not found at ${src}`)
  }
}
