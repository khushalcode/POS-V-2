// Add useShopFetch import and hook to management page files
// Uses string manipulation to insert after the last existing import line
// and after the first line of the default export function body.

import fs from 'fs'

const files = [
  'src/components/management/pages/DashboardPage.tsx',
  'src/components/management/pages/MenuPage.tsx',
  'src/components/management/pages/CustomersPage.tsx',
  'src/components/management/pages/SuppliersPage.tsx',
  'src/components/management/pages/PurchasesPage.tsx',
  'src/components/management/pages/ExpensesPage.tsx',
  'src/components/management/pages/MoneyInPage.tsx',
  'src/components/management/pages/MoneyOutPage.tsx',
  'src/components/management/pages/ReportsPage.tsx',
  'src/components/management/pages/SettingsPage.tsx',
  'src/components/management/pages/BackupPage.tsx',
  'src/components/management/pages/ZomatoPage.tsx',
]

const IMPORT_LINE = "import { useShopFetch } from '@/hooks/use-shop-fetch'"
const HOOK_LINE = '  const shopFetch = useShopFetch()'

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8')
  if (content.includes('useShopFetch')) {
    console.log('SKIP', f)
    continue
  }

  // Insert import after the last `from '...'` line in the import block
  const importLines = content.split('\n')
  let lastImportIdx = -1
  for (let i = 0; i < importLines.length; i++) {
    if (importLines[i].match(/^import .+from\s+['"]/)) lastImportIdx = i
  }
  if (lastImportIdx === -1) {
    console.log('FAIL no import line in', f)
    continue
  }
  importLines.splice(lastImportIdx + 1, 0, IMPORT_LINE)

  // Find the first line that starts the default export function body
  // (line after `export default function XXX() {`)
  let funcBodyIdx = -1
  for (let i = 0; i < importLines.length; i++) {
    if (importLines[i].match(/^export default function \w+\(/)) {
      // find the line that contains `{` ending the function signature
      for (let j = i; j < Math.min(i + 5, importLines.length); j++) {
        if (importLines[j].includes('{')) {
          funcBodyIdx = j + 1
          break
        }
      }
      break
    }
  }
  if (funcBodyIdx === -1) {
    console.log('FAIL no function body in', f)
    continue
  }
  importLines.splice(funcBodyIdx, 0, HOOK_LINE)

  fs.writeFileSync(f, importLines.join('\n'))
  console.log('OK', f)
}
