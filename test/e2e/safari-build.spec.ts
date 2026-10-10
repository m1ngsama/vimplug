import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { resolve } from 'node:path'
import { serveFixtures } from '../fixtures.ts'

// Chromium loads the Safari build without the permissions Safari withholds, which puts it
// on the same fallback paths; nothing else automated reaches them.
const EXT = resolve('dist/safari')

let stop: () => Promise<void>
let base: string
let ctx: BrowserContext

async function open(path: string): Promise<Page> {
  const page = await ctx.newPage()
  await page.goto(`${base}${path}`)
  await page.waitForFunction(() => document.documentElement.dataset.vimplug === 'on')
  return page
}

// The tab closes on keydown, so the keyup that press() sends has no page left to land on.
const closeWithX = (page: Page) => page.keyboard.down('x').catch(() => {})

async function tabUrls(): Promise<(string | undefined)[]> {
  const [sw] = ctx.serviceWorkers()
  return await sw!.evaluate(async () => (await chrome.tabs.query({})).map(t => t.url))
}

test.beforeAll(async () => {
  ;({ base, stop } = await serveFixtures())
  ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  })
  if (ctx.serviceWorkers().length === 0) await ctx.waitForEvent('serviceworker')
})

test.afterAll(async () => {
  await ctx.close()
  await stop()
})

test('X reopens closed tabs, most recent first, without the sessions API', async () => {
  const [sw] = ctx.serviceWorkers()
  expect(await sw!.evaluate(() => typeof chrome.sessions)).toBe('undefined')

  const keep = await open('/tall')
  const first = await open('/links')
  const second = await open('/find')

  await first.bringToFront()
  await closeWithX(first)
  await second.bringToFront()
  await closeWithX(second)
  await expect.poll(tabUrls).toEqual(['about:blank', `${base}/tall`])

  await keep.bringToFront()
  await keep.keyboard.press('Shift+X')
  await expect.poll(tabUrls).toEqual(['about:blank', `${base}/tall`, `${base}/find`])

  await keep.bringToFront()
  await keep.keyboard.press('Shift+X')
  await expect.poll(tabUrls).toEqual([
    'about:blank',
    `${base}/tall`,
    `${base}/links`,
    `${base}/find`,
  ])

  await keep.bringToFront()
  await keep.keyboard.press('Shift+X')
  await expect.poll(tabUrls).toHaveLength(4)
})

test('an action the browser cannot run says so', async () => {
  const page = await open('/tall')
  await page.keyboard.press('g')
  await page.keyboard.press('s')
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('[data-vimplug-ui]').length)).toBe(1)
  expect(await tabUrls()).not.toContain(`view-source:${base}/tall`)
  await page.close()
})
