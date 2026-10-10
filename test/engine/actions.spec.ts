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

test.describe('scrolling', () => {
  test('releasing j while k is still down leaves k scrolling', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.evaluate(() => window.scrollTo(0, 2000))
    await page.keyboard.down('j')
    await page.waitForTimeout(300)
    await page.keyboard.down('k')
    await page.keyboard.up('j')
    await page.waitForTimeout(200)
    const rolled = await page.evaluate(() => window.scrollY)
    await page.waitForTimeout(300)
    const later = await page.evaluate(() => window.scrollY)
    await page.keyboard.up('k')
    expect(later).toBeLessThan(rolled - 100)
  })

  test('a released hold stops where it is', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.down('j')
    await page.waitForTimeout(400)
    await page.keyboard.up('j')
    await page.waitForTimeout(60)
    const stopped = await page.evaluate(() => window.scrollY)
    await page.waitForTimeout(250)
    expect(stopped).toBeGreaterThan(100)
    expect(await page.evaluate(() => window.scrollY)).toBe(stopped)
  })

  test('key repeats of a held d do not pile up half pages', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    for (let i = 0; i < 6; i += 1) await page.keyboard.down('d')
    await page.keyboard.up('d')
    await page.waitForTimeout(600)
    const half = await page.evaluate(() => window.innerHeight / 2)
    expect(await page.evaluate(() => window.scrollY)).toBe(half)
  })

  test('a scroll the page makes mid-motion is kept, not undone', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('d')
    await page.evaluate(() => window.scrollBy(0, 1000))
    await page.waitForTimeout(600)
    const half = await page.evaluate(() => window.innerHeight / 2)
    expect(await page.evaluate(() => window.scrollY)).toBe(1000 + half)
  })
})

test.describe('bindings shared with other vim extensions', () => {
  const sent = (page: Page) => page.evaluate(() => (window as any).__vimplugSent ?? [])

  test('O opens what was typed in a new tab', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('Shift+O')
    await page.keyboard.type('example.com')
    await page.keyboard.press('Enter')
    await expect.poll(() => sent(page)).toContainEqual({ type: 'openUrl', url: 'https://example.com' })
    expect(page.url()).toBe(`${base}/tall`)
  })

  test('gE edits the page URL and opens it in a new tab', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('g')
    await page.keyboard.press('Shift+E')
    await page.keyboard.type('?x=1')
    await page.keyboard.press('Enter')
    await expect
      .poll(() => sent(page))
      .toContainEqual({ type: 'openUrl', url: `${base}/tall?x=1` })
  })

  test('R, gt and gT reach the background', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('Shift+R')
    await page.keyboard.press('g')
    await page.keyboard.press('t')
    await page.keyboard.press('g')
    await page.keyboard.press('Shift+T')
    await expect
      .poll(async () => (await sent(page)).filter((m: any) => m.type === 'runAction').map((m: any) => m.id))
      .toEqual(['reloadHard', 'nextTab', 'prevTab'])
  })

  test('. repeats the last action with its count', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('3')
    await page.keyboard.press('Shift+K')
    await page.keyboard.press('.')
    await expect
      .poll(async () => (await sent(page)).filter((m: any) => m.type === 'runAction'))
      .toEqual([
        { type: 'runAction', id: 'nextTab', count: 3 },
        { type: 'runAction', id: 'nextTab', count: 3 },
      ])
  })

  test('. before any action leaves the key to the page', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.evaluate(() =>
      document.addEventListener('keydown', e => {
        if (e.key === '.') document.title = 'page-saw-it'
      }),
    )
    await page.keyboard.press('.')
    await expect(page).toHaveTitle('page-saw-it')
  })

  test('2gu climbs two URL levels', async ({ page }) => {
    await loadEngine(page, `${base}/x/y/z`)
    await page.keyboard.press('2')
    await page.keyboard.press('g')
    await page.keyboard.press('u')
    await expect(page).toHaveURL(`${base}/x`)
  })
})

test.describe('find from the selection', () => {
  const selectFirstMarker = (page: Page) =>
    page.evaluate(() => {
      const text = document.getElementById('one')!.firstChild!
      getSelection()!.setBaseAndExtent(text, 6, text, 12)
    })
  const selectedIn = (page: Page) =>
    page.evaluate(() => getSelection()?.anchorNode?.parentElement?.id ?? '')

  test('* jumps to the next occurrence of the selected text and wraps', async ({ page }) => {
    await loadEngine(page, `${base}/twice`)
    await selectFirstMarker(page)
    await page.keyboard.press('Shift+8')
    await expect.poll(() => selectedIn(page)).toBe('two')
    await page.keyboard.press('Shift+8')
    await expect.poll(() => selectedIn(page)).toBe('one')
  })

  test('# jumps to the previous occurrence', async ({ page }) => {
    await loadEngine(page, `${base}/twice`)
    await selectFirstMarker(page)
    await page.keyboard.press('Shift+8')
    await expect.poll(() => selectedIn(page)).toBe('two')
    await page.keyboard.press('Shift+3')
    await expect.poll(() => selectedIn(page)).toBe('one')
  })

  test('* with nothing selected leaves the key to the page', async ({ page }) => {
    await loadEngine(page, `${base}/twice`)
    await page.evaluate(() =>
      document.addEventListener('keydown', e => {
        if (e.code === 'Digit8') document.title = 'page-saw-it'
      }),
    )
    await page.keyboard.press('Shift+8')
    await expect(page).toHaveTitle('page-saw-it')
  })
})

test.describe('visual mode motions', () => {
  const selected = (page: Page) => page.evaluate(() => getSelection()!.toString())

  test('a count repeats the motion', async ({ page }) => {
    await loadEngine(page, `${base}/visual`)
    await page.keyboard.press('v')
    await page.keyboard.press('3')
    await page.keyboard.press('l')
    await expect.poll(() => selected(page)).toBe('one')
  })

  test('o moves the cursor to the other end of the selection', async ({ page }) => {
    await loadEngine(page, `${base}/visual`)
    await page.keyboard.press('v')
    await page.keyboard.press('3')
    await page.keyboard.press('l')
    await page.keyboard.press('o')
    await page.keyboard.press('l')
    await expect.poll(() => selected(page)).toBe('ne')
  })

  test('V selects the whole line', async ({ page }) => {
    await loadEngine(page, `${base}/visual`)
    await page.keyboard.press('v')
    await page.keyboard.press('Shift+V')
    await expect.poll(() => selected(page)).toBe('one two three four')
  })
})

test.describe('hinting several links', () => {
  test('<A-f> opens each chosen link in a background tab and keeps the hints', async ({ page }) => {
    await loadEngine(page, `${base}/links`)
    await page.keyboard.press('Alt+f')
    for (let i = 0; i < 2; i += 1) {
      await page.keyboard.press('t')
      await page.keyboard.press('Enter')
    }
    const opened = { type: 'openUrl', url: `${base}/textarea`, active: false }
    await expect
      .poll(() =>
        page.evaluate(() =>
          ((window as any).__vimplugSent ?? []).filter((m: { type: string }) => m.type === 'openUrl'),
        ),
      )
      .toEqual([opened, opened])
    expect(page.url()).toBe(`${base}/links`)

    await page.keyboard.press('Escape')
    await page.keyboard.press('j')
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
  })
})
