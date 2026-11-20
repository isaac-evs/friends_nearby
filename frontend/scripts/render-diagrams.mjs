/**
 * Convierte los diagramas HTML de Archify (`docs/diagrams/*.html`) a PNG (`docs/diagrams/png/`) para poder usarlos en los README.
 * Uso, desde frontend/:  node scripts/render-diagrams.mjs
 */
import { chromium } from '@playwright/test'
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/diagrams')
await mkdir(path.join(DIR, 'png'), { recursive: true })
const files = (await readdir(DIR)).filter((f) => f.endsWith('.html'))
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' })
for (const f of files) {
  const page = await context.newPage()
  await page.goto(pathToFileURL(path.join(DIR, f)).href)
  await page.waitForTimeout(1200)
  const out = path.join(DIR, 'png', f.replace(/\.html$/, '.png'))
  // Solo el lienzo del diagrama (sin barra de herramientas ni índice): sirve para los README.
  await page.locator('.diagram-container svg').first().screenshot({ path: out, omitBackground: false })
  console.log('✓', path.relative(DIR, out))
  await page.close()
}
await browser.close()
