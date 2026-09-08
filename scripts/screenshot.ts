import { chromium } from '@playwright/test'
import { resolve } from 'node:path'

const EXT = resolve('dist/chrome')

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  viewport: { width: 1000, height: 820 },
  deviceScaleFactor: 2,
})

if (ctx.serviceWorkers().length === 0) await ctx.waitForEvent('serviceworker')
const [sw] = ctx.serviceWorkers()
const id = new URL(sw!.url()).host

const page = await ctx.newPage()
await page.goto(`chrome-extension://${id}/options.html`)
await page.waitForSelector('.cap')
await page.screenshot({ path: 'docs/settings.png' })

await ctx.close()
console.info('wrote docs/settings.png')
