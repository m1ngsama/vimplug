import { test, expect, type Page } from '@playwright/test'
import { loadEngine, serveFixtures } from './harness.ts'

let base: string
let stop: () => Promise<void>

test.beforeAll(async () => {
  ;({ base, stop } = await serveFixtures())
})

test.afterAll(async () => {
  await stop()
})

test.describe('pager', () => {
  test(']] follows "Next" over "Learn more" and ignores a hidden link', async ({ page }) => {
    await loadEngine(page, `${base}/pager`)
    await page.keyboard.press(']')
    await page.keyboard.press(']')
    await expect(page).toHaveURL(/\/pager-next$/)
  })

  test(']] and [[ follow Chinese pager links', async ({ page }) => {
    await loadEngine(page, `${base}/pager-zh`)
    await page.keyboard.press(']')
    await page.keyboard.press(']')
    await expect(page).toHaveURL(/\/pager-next$/)

    await loadEngine(page, `${base}/pager-zh`)
    await page.keyboard.press('[')
    await page.keyboard.press('[')
    await expect(page).toHaveURL(/\/pager-prev$/)
  })

  test(']] follows the document <link rel="next"> before any anchor', async ({ page }) => {
    await loadEngine(page, `${base}/pager-link`)
    await page.keyboard.press(']')
    await page.keyboard.press(']')
    await expect(page).toHaveURL(/\/pager-next$/)
  })

  test(']] with nothing to follow leaves the key to the page', async ({ page }) => {
    await loadEngine(page, `${base}/pager-none`)
    await page.keyboard.press(']')
    await page.keyboard.press(']')
    await expect(page).toHaveTitle(']]')
  })
})

test.describe('focus input', () => {
  const focusedId = (page: Page) =>
    page.evaluate(() => document.activeElement?.id ?? '')

  test('gi skips disabled, readonly and hidden fields', async ({ page }) => {
    await loadEngine(page, `${base}/fields`)
    await page.keyboard.press('g')
    await page.keyboard.press('i')
    await expect.poll(() => focusedId(page)).toBe('a')
  })

  test('a count picks the nth field', async ({ page }) => {
    await loadEngine(page, `${base}/fields`)
    await page.keyboard.press('2')
    await page.keyboard.press('g')
    await page.keyboard.press('i')
    await expect.poll(() => focusedId(page)).toBe('b')
  })

  test('a count past the end stops at the last field', async ({ page }) => {
    await loadEngine(page, `${base}/fields`)
    await page.keyboard.press('9')
    await page.keyboard.press('g')
    await page.keyboard.press('i')
    await expect.poll(() => focusedId(page)).toBe('c')
  })
})

test.describe('marks', () => {
  test('a mark restores the pane being scrolled, not the window', async ({ page }) => {
    await loadEngine(page, `${base}/pane`)
    const paneTop = () => page.evaluate(() => document.getElementById('pane')!.scrollTop)
    const bottom = await page.evaluate(() => {
      const pane = document.getElementById('pane')!
      pane.scrollTop = pane.scrollHeight
      return pane.scrollTop
    })
    await page.keyboard.press('Shift+m')
    await page.keyboard.press('a')
    await page.waitForTimeout(200)

    await page.evaluate(() => {
      document.getElementById('pane')!.scrollTop = 0
    })
    await page.keyboard.press('`')
    await page.keyboard.press('a')
    await expect.poll(paneTop).toBe(bottom)
  })

  test('a mark falls back to the window when no pane scrolls', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.evaluate(() => window.scrollTo(0, 1200))
    await page.keyboard.press('Shift+m')
    await page.keyboard.press('a')
    await page.waitForTimeout(200)

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.keyboard.press('`')
    await page.keyboard.press('a')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1200)
  })
})
