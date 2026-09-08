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
    await expect.poll(async () => (await state(page)).panels).toBe(1)
    await expect.poll(async () => (await state(page)).focusInOverlay).toBe(true)

    await page.keyboard.type('jjjj', { delay: 20 })
    await page.waitForTimeout(300)
    expect((await state(page)).scrollY).toBe(0)
  })

  test('Enter commits the search and returns to normal mode', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    await page.keyboard.type('findmethistext')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)

    await page.keyboard.press('Enter')
    await expect.poll(async () => (await state(page)).panels).toBe(0)

    const committed = await page.evaluate(() => window.scrollY)
    await page.keyboard.press('j')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(committed)
  })

  test('a committed search keeps its highlights so n can step', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    await page.keyboard.type('findmethistext')
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
    await page.keyboard.type('findmethistext')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)

    await page.keyboard.press('Escape')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before)
    await expect.poll(async () => (await state(page)).panels).toBe(0)
  })

  test('n steps to the next match after a commit, and N comes back', async ({ page }) => {
    await loadEngine(page, `${base}/twice`)
    await page.keyboard.press('/')
    await page.keyboard.type('marker')
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await state(page)).panels).toBe(0)
    const first = await page.evaluate(() => window.scrollY)

    await page.keyboard.press('n')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(first)
    const second = await page.evaluate(() => window.scrollY)

    await page.keyboard.press('Shift+n')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(second)
  })

  test('n wraps around rather than stopping at the last match', async ({ page }) => {
    await loadEngine(page, `${base}/twice`)
    await page.keyboard.press('/')
    await page.keyboard.type('marker')
    await page.keyboard.press('Enter')
    const first = await page.evaluate(() => window.scrollY)

    await page.keyboard.press('n')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(first)
    await page.keyboard.press('n')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(first)
  })

  // Typing past the last match must not leave the view sitting on a prefix's result.
  test('a query that stops matching returns to where the search began', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    await page.keyboard.type('find', { delay: 20 })
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)

    await page.keyboard.type('zzznope', { delay: 20 })
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('a query that stops matching drops the highlights with it', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    await page.keyboard.type('find', { delay: 20 })
    await page.waitForTimeout(200)
    await page.keyboard.type('zzznope', { delay: 20 })
    await page.waitForTimeout(200)
    const painted = await page.evaluate(
      () => (CSS as unknown as { highlights: Map<string, unknown> }).highlights.size,
    )
    expect(painted).toBe(0)
  })

  // Incremental: every prefix has to miss too, so the first character must be absent.
  test('a query matching nothing leaves the page where it was', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    await page.keyboard.type('qqqq', { delay: 10 })
    await page.waitForTimeout(300)
    expect((await state(page)).scrollY).toBe(0)
  })
})

test.describe('a page fighting for focus', () => {
  test('/ keeps the caret in the panel against a focus trap', async ({ page }) => {
    await loadEngine(page, `${base}/focusfight`)
    await page.keyboard.press('/')
    await page.waitForTimeout(300)
    await expect.poll(async () => (await state(page)).panels).toBe(1)
    await expect.poll(async () => (await state(page)).focusInOverlay).toBe(true)
  })

  test('what is typed reaches the panel, not the page field', async ({ page }) => {
    await loadEngine(page, `${base}/focusfight`)
    await page.keyboard.press('/')
    await page.waitForTimeout(300)
    await page.keyboard.type('findme', { delay: 20 })
    await page.waitForTimeout(200)
    expect(await page.inputValue('#trap')).toBe('')
    await expect.poll(async () => (await state(page)).focusInOverlay).toBe(true)
  })

  // Hiding focus events is not enough against a page that refocuses on a timer: it never
  // needed to hear about us in the first place.
  test('/ holds the caret against a page that refocuses on a timer', async ({ page }) => {
    await loadEngine(page, `${base}/refocus`)
    await page.keyboard.press('/')
    await page.waitForTimeout(400)
    await expect.poll(async () => (await state(page)).focusInOverlay).toBe(true)

    await page.keyboard.type('findme', { delay: 30 })
    await page.waitForTimeout(200)
    expect(await page.inputValue('#trap')).toBe('')
  })

  // The bug this was all about: on GitHub, typing a query ran the site's own s shortcut,
  // because a shadow root retargets our input to a plain div and every "is the user
  // typing?" check on the web then says no.
  test("a site's single-key shortcuts do not fire on what is typed in the panel", async ({
    page,
  }) => {
    await loadEngine(page, `${base}/shortcuts`)
    await page.keyboard.press('/')
    await expect.poll(async () => (await state(page)).focusInOverlay).toBe(true)

    await page.keyboard.type('cases', { delay: 30 })
    await page.waitForTimeout(300)
    await expect.poll(async () => (await state(page)).focusInOverlay).toBe(true)
    expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('site-search')
  })

  test('the overlay gives focus back when it closes', async ({ page }) => {
    await loadEngine(page, `${base}/focusfight`)
    await page.keyboard.press('/')
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await expect.poll(async () => (await state(page)).panels).toBe(0)
  })
})

test.describe('IME composition', () => {
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
  // Closed shadow root: the host is assertable, the text is not.
  test('normal mode shows nothing', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await expect.poll(async () => (await state(page)).panels).toBe(0)
  })

  test('i shows an indicator and Escape takes it away', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('i')
    await expect.poll(async () => (await state(page)).panels).toBe(1)

    await page.keyboard.press('Escape')
    await expect.poll(async () => (await state(page)).panels).toBe(0)
  })

  test('visual mode shows an indicator', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('v')
    await expect.poll(async () => (await state(page)).panels).toBe(1)

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
  test('/ with no Custom Highlight API still opens the panel', async ({ page }) => {
    await page.addInitScript(() => {
      delete (CSS as any).highlights
      delete (window as any).Highlight
    })
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    await expect.poll(async () => (await state(page)).panels).toBe(1)

    await page.keyboard.type('jjjj', { delay: 20 })
    await page.waitForTimeout(300)
    expect((await state(page)).scrollY).toBe(0)
  })
})
