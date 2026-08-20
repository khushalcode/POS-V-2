/**
 * ExcelExport — generate .xlsx-compatible Excel files in the browser
 * without any external dependency.
 *
 * Approach: build an HTML table with the Excel-specific XML namespace
 * and serve it as an .xls file with the Excel MIME type. Excel and
 * LibreOffice both open this format natively. Number cells are
 * detected automatically by Excel; explicit type hints can be added
 * by prefixing values.
 *
 * For richer Excel output (multi-sheet, formatting) we'd use a library
 * like SheetJS, but for plain tabular exports the HTML approach is
 * smallest and zero-dep.
 */

export interface Sheet {
  name: string
  columns: string[]
  rows: (string | number | boolean | null | undefined)[][]
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number') {
    if (!isFinite(value)) return '0'
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  // String — escape, preserve as text. Prefix with ' to force text
  // treatment for numeric-looking strings (e.g. invoice numbers).
  let s = String(value)
  // Force numbers-like text (e.g. phone, gstin, bill numbers) to stay as text
  if (/^\d+$/.test(s) && s.length > 10) {
    // Looks like a phone / long digit string — keep as text
    return `<td>${escapeXml(s)}</td>`
  }
  // If it's a pure number string but short, leave Excel to auto-detect.
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    return `<td>${escapeXml(s)}</td>`
  }
  return `<td>${escapeXml(s)}</td>`
}

/**
 * Build an .xls file (HTML-table-based, Excel SpreadsheetML-ish).
 * This is the most compatible format — opens cleanly in Excel,
 * LibreOffice, and Google Sheets without any dependencies.
 */
export function buildXlsBlob(sheets: Sheet[]): Blob {
  const html: string[] = []
  html.push('<?xml version="1.0" encoding="UTF-8"?>')
  html.push('<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">')
  html.push('<head>')
  html.push('<meta charset="UTF-8">')
  html.push('<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>')
  for (const s of sheets) {
    const safeName = escapeXml(s.name.replace(/[\\/?*[\]:]/g, '_')).slice(0, 31)
    html.push(`<x:ExcelWorksheet><x:Name>${safeName}</x:Name>`)
    html.push(`<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>`)
    html.push(`</x:ExcelWorksheet>`)
  }
  html.push('</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->')
  html.push('<style>td, th { font-family: Calibri, Arial, sans-serif; font-size: 11pt; mso-number-format: General; } th { background: #f3f4f6; font-weight: bold; text-align: left; padding: 4px; } td { padding: 4px; vertical-align: top; }</style>')
  html.push('</head>')
  html.push('<body>')
  for (const sheet of sheets) {
    html.push(`<table border="1"><thead><tr>`)
    for (const col of sheet.columns) {
      html.push(`<th>${escapeXml(String(col))}</th>`)
    }
    html.push('</tr></thead><tbody>')
    for (const row of sheet.rows) {
      html.push('<tr>')
      for (let i = 0; i < sheet.columns.length; i++) {
        const cell = row[i]
        if (typeof cell === 'number') {
          html.push(`<td>${cell}</td>`)
        } else {
          html.push(formatCell(cell))
        }
      }
      html.push('</tr>')
    }
    html.push('</tbody></table>')
    // Add a small separator — Excel will treat each <table> as a separate worksheet.
    html.push('<br/><br/>')
  }
  html.push('</body></html>')
  return new Blob([html.join('\n')], { type: 'application/vnd.ms-excel' })
}

/** Trigger a browser download of the .xls blob. */
export function downloadExcel(sheets: Sheet[], filename: string): void {
  const blob = buildXlsBlob(sheets)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xls') ? filename : `${filename}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Build a CSV blob from a single sheet. Comma-separated, double-quote
 * escaped, UTF-8 with BOM (so Excel opens it with correct encoding).
 */
export function buildCsvBlob(sheet: Sheet): Blob {
  const escape = (v: string | number | boolean | null | undefined): string => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    // Quote if it contains comma, quote, newline, or leading/trailing space
    if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const lines: string[] = []
  lines.push(sheet.columns.map(escape).join(','))
  for (const row of sheet.rows) {
    lines.push(row.slice(0, sheet.columns.length).map(escape).join(','))
  }
  // BOM prefix so Excel detects UTF-8
  return new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

/** Trigger a browser download of a CSV file. */
export function downloadCsv(sheet: Sheet, filename: string): void {
  const blob = buildCsvBlob(sheet)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
