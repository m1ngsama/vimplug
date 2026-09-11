import { test, expect } from '@playwright/test'
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
