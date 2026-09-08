import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// A keycap: yellow face over a darker skirt, carrying a bold v. The yellow is the same
// one the hint overlay paints, so the icon and the thing you see every day match.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="8" y="8" width="112" height="112" rx="24" fill="#b8933a"/>
  <rect x="8" y="8" width="112" height="102" rx="24" fill="#ffd76e"/>
  <path d="M40 46 L64 90 L88 46" fill="none" stroke="#21201c"
        stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const SIZES = [16, 32, 48, 128, 512]

const browser = await chromium.launch()
mkdirSync('assets', { recursive: true })

for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${SVG}`,
  )
  writeFileSync(`assets/icon-${size}.png`, await page.screenshot({ omitBackground: true }))
  await page.close()
}

await browser.close()
console.info(`wrote ${SIZES.length} icons`)
