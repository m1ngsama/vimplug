import { test, expect } from '@playwright/test'
import { loadEngine, serveFixtures, state, composingKey } from './harness.ts'

let base: string
let stop: () => Promise<void>

test.beforeAll(async () => {
  ;({ base, stop } = await serveFixtures())
})

test.afterAll(async () => {
  await stop()
})

test.describe('find mode', () => {
  test('/ opens the panel and takes the keystrokes with it', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    expect(await state(page)).toMatchObject({ panels: 1, focusInOverlay: true })

    await page.keyboard.type('jjjj', { delay: 20 })
    await page.waitForTimeout(300)
    expect((await state(page)).scrollY).toBe(0)
  })

  test('Enter commits the search and returns to normal mode', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    await page.keyboard.type('needlexyz')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)

    await page.keyboard.press('Enter')
    expect((await state(page)).panels).toBe(0)

    // Back in normal mode, so an ordinary binding works again.
    const committed = await page.evaluate(() => window.scrollY)
    await page.keyboard.press('j')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(committed)
  })

  test('a committed search keeps its highlights so n can step', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    await page.keyboard.type('needlexyz')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(150)

    const painted = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--vp-match'),
    )
    expect(painted).not.toBe('')
  })

  test('Escape cancels the search and restores the pre-search position', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.evaluate(() => window.scrollTo(0, 120))
    const before = await page.evaluate(() => window.scrollY)

    await page.keyboard.press('/')
    await page.keyboard.type('needlexyz')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)

    await page.keyboard.press('Escape')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before)
    expect((await state(page)).panels).toBe(0)
  })

  // The search is incremental, so every prefix of the query has to miss too. 'q' appears
  // nowhere in the fixture; a query merely absent as a whole would still scroll on its
  // first character.
  test('a query matching nothing leaves the page where it was', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    await page.keyboard.type('qqqq', { delay: 10 })
    await page.waitForTimeout(300)
    expect((await state(page)).scrollY).toBe(0)
  })
})

test.describe('IME composition', () => {
  // Pinyin for a word is a run of latin letters. Each one arrives as a keydown carrying
  // keyCode 229 while the IME composes, and every one of them is also a vim binding.
  test('keys sent while an IME is composing never run as commands', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    for (const [key, code] of [
      ['j', 'KeyJ'],
      ['i', 'KeyI'],
      ['a', 'KeyA'],
      ['n', 'KeyN'],
      ['d', 'KeyD'],
      ['a', 'KeyA'],
      ['n', 'KeyN'],
    ] as const) {
      await composingKey(page, key, code)
    }
    await page.waitForTimeout(400)
    expect((await state(page)).scrollY).toBe(0)
  })

  test('a composing f does not open hints', async ({ page }) => {
    await loadEngine(page, `${base}/links`)
    const before = await page.evaluate(() => document.body.childElementCount)
    await composingKey(page, 'f', 'KeyF')
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => document.body.childElementCount)).toBe(before)
  })

  test('normal keys still work once composition is over', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await composingKey(page, 'j', 'KeyJ')
    await page.waitForTimeout(150)
    expect((await state(page)).scrollY).toBe(0)

    await page.keyboard.press('j')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  })
})

test.describe('mode indicator', () => {
  // The badge lives in a closed shadow root, so the test asserts the host appears and goes
  // rather than reading the text. indicator.test.ts covers which label each mode gets.
  test('normal mode shows nothing', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    expect((await state(page)).panels).toBe(0)
  })

  test('i shows an indicator and Escape takes it away', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('i')
    expect((await state(page)).panels).toBe(1)

    await page.keyboard.press('Escape')
    await expect.poll(async () => (await state(page)).panels).toBe(0)
  })

  test('visual mode shows an indicator', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('v')
    expect((await state(page)).panels).toBe(1)

    await page.keyboard.press('Escape')
    await expect.poll(async () => (await state(page)).panels).toBe(0)
  })

  test('the indicator is themed rather than borrowing the page styles', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('i')
    const accent = await page.evaluate(
      () => (document.body.lastElementChild as HTMLElement).style.getPropertyValue('--vp-accent'),
    )
    expect(accent).not.toBe('')
  })
})

test.describe('an action that cannot run must not swallow the key', () => {
  // The engine only calls preventDefault when an action reports that it ran. Reporting
  // success while doing nothing leaves the mode in normal with the listener still
  // attached, so every following keystroke is a command.
  test('/ with no Custom Highlight API still opens the panel', async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (CSS as any).highlights
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).Highlight
    })
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    expect((await state(page)).panels).toBe(1)

    await page.keyboard.type('jjjj', { delay: 20 })
    await page.waitForTimeout(300)
    expect((await state(page)).scrollY).toBe(0)
  })
})
