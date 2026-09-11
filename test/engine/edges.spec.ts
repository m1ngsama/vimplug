import { test, expect, type Page } from '@playwright/test'
import { loadEngine, serveFixtures, state, composingKey } from './harness.ts'

// A busy machine can start the animation later than one poll, so leave `from` before settling.
async function settled(page: Page, from: number): Promise<number> {
  await expect.poll(() => page.evaluate(() => window.scrollY)).not.toBe(from)
  let last = -1
  let quiet = 0
  for (let i = 0; i < 40 && quiet < 2; i += 1) {
    const y = await page.evaluate(() => window.scrollY)
    quiet = y === last ? quiet + 1 : 0
    last = y
    await page.waitForTimeout(60)
  }
  return last
}

// Linux headless Chromium steps 62px where macOS steps 60: measure a step, never hardcode it.
async function step(page: Page): Promise<number> {
  await page.keyboard.press('j')
  const y = await settled(page, 0)
  await page.evaluate(() => window.scrollTo(0, 0))
  return y
}

let base: string
let stop: () => Promise<void>

test.beforeAll(async () => {
  ;({ base, stop } = await serveFixtures())
})

test.afterAll(async () => {
  await stop()
})

test.describe('counts', () => {
  test('a count multiplies the motion', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    const one = await step(page)

    await page.keyboard.press('5')
    await page.keyboard.press('j')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(one * 4)
  })

  test('a count is spent once and does not linger', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    const one = await step(page)

    await page.keyboard.press('3')
    await page.keyboard.press('j')
    const after = await settled(page, 0)
    expect(after).toBeGreaterThan(one * 2)

    await page.keyboard.press('j')
    const next = await settled(page, after)
    expect(next).toBeGreaterThan(after)
    expect(next).toBeLessThan(after + one * 2)
  })

  test('Escape abandons a count', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    const one = await step(page)

    await page.keyboard.press('5')
    await page.keyboard.press('Escape')
    await page.keyboard.press('j')
    const y = await settled(page, 0)
    expect(y).toBeGreaterThan(0)
    expect(y).toBeLessThan(one * 2)
  })

  test('a bare 0 stays a binding rather than starting a count', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    const one = await step(page)

    await page.keyboard.press('0')
    await page.keyboard.press('j')
    const y = await settled(page, 0)
    expect(y).toBeGreaterThan(0)
    expect(y).toBeLessThan(one * 2)
  })

  test('a multi-digit count applies whole', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    const one = await step(page)

    await page.keyboard.press('1')
    await page.keyboard.press('2')
    await page.keyboard.press('j')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(one * 10)
  })
})

test.describe('half-typed bindings', () => {
  test('Escape abandons a pending prefix', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.evaluate(() => window.scrollTo(0, 900))
    const before = await page.evaluate(() => window.scrollY)
    await page.keyboard.press('g')
    await page.keyboard.press('Escape')
    await page.keyboard.press('j')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before)
  })

  test('a prefix followed by an unbound key runs neither', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.evaluate(() => window.scrollTo(0, 900))
    const before = await page.evaluate(() => window.scrollY)
    await page.keyboard.press('g')
    await page.keyboard.press('q')
    await page.waitForTimeout(200)
    expect(await page.evaluate(() => window.scrollY)).toBe(before)

    await page.keyboard.press('j')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before)
  })

  test('gg reaches the top through the prefix', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.evaluate(() => window.scrollTo(0, 2000))
    await page.keyboard.press('g')
    await page.keyboard.press('g')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  })
})

test.describe('focus decides the mode', () => {
  test('a page that focuses its own field on load leaves the engine quiet', async ({ page }) => {
    await loadEngine(page, `${base}/steals`)
    await page.keyboard.type('jjjj')
    expect(await page.inputValue('#s')).toBe('jjjj')
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('leaving the field brings the engine back', async ({ page }) => {
    await loadEngine(page, `${base}/steals`)
    await page.keyboard.type('jj')
    await page.evaluate(() => (document.getElementById('s') as HTMLInputElement).blur())
    await page.keyboard.press('j')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  })

  test('an input inside a shadow root counts as typing', async ({ page }) => {
    await loadEngine(page, `${base}/shadow`)
    await page.evaluate(() => {
      const host = document.getElementById('h')!
      host.attachShadow({ mode: 'open' }).innerHTML = '<input id="i">'
      ;(host.shadowRoot!.getElementById('i') as HTMLInputElement).focus()
    })
    await page.keyboard.type('jjjj')
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('an editor nested in several shadow roots counts as typing', async ({ page }) => {
    await loadEngine(page, `${base}/shadow`)
    await page.evaluate(() => {
      let root: ShadowRoot = document.getElementById('h')!.attachShadow({ mode: 'open' })
      for (let i = 0; i < 2; i += 1) {
        const inner = document.createElement('div')
        root.append(inner)
        root = inner.attachShadow({ mode: 'open' })
      }
      root.innerHTML = '<div id="e" contenteditable></div>'
      ;(root.getElementById('e') as HTMLElement).focus()
    })
    await page.keyboard.type('jjjj')
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('typing in a contenteditable does not scroll', async ({ page }) => {
    await loadEngine(page, `${base}/editable`)
    await page.focus('#e')
    await page.keyboard.type('jjjj')
    expect(await page.textContent('#e')).toBe('jjjj')
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
})

test.describe('keys that belong to the page', () => {
  test('an unbound modifier combo reaches the page', async ({ page }) => {
    await loadEngine(page, `${base}/cmdk`)
    await page.keyboard.press('Meta+k')
    await expect.poll(() => page.textContent('#out')).toBe('page-saw-it')
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('an unbound plain key does nothing and scrolls nothing', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('q')
    await page.waitForTimeout(200)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
})

test.describe('suspend and resume', () => {
  test('i suspends the engine until Escape', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('i')
    await page.keyboard.press('j')
    await page.waitForTimeout(200)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    await page.keyboard.press('Escape')
    await page.keyboard.press('j')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  })
})

test.describe('find over awkward text', () => {
  test('a match split across elements is found', async ({ page }) => {
    await loadEngine(page, `${base}/awkward`)
    await page.keyboard.press('/')
    await page.keyboard.type('wordbreak')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)
  })

  test('regex metacharacters are matched literally', async ({ page }) => {
    await loadEngine(page, `${base}/awkward`)
    await page.keyboard.press('/')
    await page.keyboard.type('$5.00 (approx)')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)
  })

  test('text in separate blocks does not run together into a match', async ({ page }) => {
    await loadEngine(page, `${base}/blocks`)
    await page.keyboard.press('/')
    await page.keyboard.type('cd', { delay: 20 })
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('text in a hidden element is not a match', async ({ page }) => {
    await loadEngine(page, `${base}/hidden`)
    await page.keyboard.press('/')
    await page.keyboard.type('hiddenword', { delay: 20 })
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('a+b*c is a string, not a pattern', async ({ page }) => {
    await loadEngine(page, `${base}/awkward`)
    await page.keyboard.press('/')
    await page.keyboard.type('a+b*c')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)
  })

  test('Enter on a query that matched nothing still leaves normal mode', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    await page.keyboard.type('qqqq')
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await state(page)).panels).toBe(0)

    await page.keyboard.press('j')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  })

  test('n before any search does nothing and does not eat the key', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('n')
    await page.waitForTimeout(200)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('Escape in normal mode retires a committed search', async ({ page }) => {
    await loadEngine(page, `${base}/find`)
    await page.keyboard.press('/')
    await page.keyboard.type('findmethistext')
    await page.keyboard.press('Enter')
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.style.getPropertyValue('--vp-match')),
      )
      .not.toBe('')

    await page.keyboard.press('Escape')
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.style.getPropertyValue('--vp-match')),
      )
      .toBe('')
  })
})

test.describe('overlays keep every key', () => {
  test('ge opens the page address for editing', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.type('ge')
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('Backspace')
    await page.keyboard.type('textarea')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`${base}/textarea`)
  })

  test('a space reaches the input rather than scrolling the page', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('o')
    await page.keyboard.type('hello world')
    await page.waitForTimeout(200)
    expect((await state(page)).scrollY).toBe(0)
    await expect.poll(async () => (await state(page)).panels).toBe(1)
  })

  test('the help overlay swallows motions too', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('Shift+/')
    await page.keyboard.type('jjjj')
    await page.waitForTimeout(200)
    expect((await state(page)).scrollY).toBe(0)
  })

  test('one overlay at a time', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('o')
    await page.keyboard.press('o')
    await page.waitForTimeout(200)
    await expect.poll(async () => (await state(page)).panels).toBe(1)
  })
})

test.describe('hints', () => {
  test('Escape leaves no hint layer behind', async ({ page }) => {
    await loadEngine(page, `${base}/links`)
    const before = await page.evaluate(() => document.body.childElementCount)
    await page.keyboard.press('f')
    expect(await page.evaluate(() => document.body.childElementCount)).toBe(before + 1)

    await page.keyboard.press('Escape')
    await expect.poll(() => page.evaluate(() => document.body.childElementCount)).toBe(before)
  })

  test('a scroll retires hints, since it invalidates their positions', async ({ page }) => {
    await loadEngine(page, `${base}/links`)
    const before = await page.evaluate(() => document.body.childElementCount)
    await page.keyboard.press('f')
    expect(await page.evaluate(() => document.body.childElementCount)).toBe(before + 1)

    await page.mouse.wheel(0, 400)
    await expect.poll(() => page.evaluate(() => document.body.childElementCount)).toBe(before)
  })

  test('one link drawn twice in a row takes one label', async ({ page }) => {
    await loadEngine(page, `${base}/row`)
    await page.keyboard.press('f')
    await page.keyboard.press('j')
    await expect(page).toHaveURL(`${base}/textarea`)
  })

  test('a merged hint answers to the text of every link in it', async ({ page }) => {
    await loadEngine(page, `${base}/row`)
    await page.keyboard.press('f')
    await page.keyboard.press('n')
    await expect(page).toHaveURL(`${base}/tall`)
  })

  for (const key of ['Shift+f', 'F']) {
    test(`a label typed as ${key} opens the link in a new tab`, async ({ page }) => {
      await loadEngine(page, `${base}/links`)
      await page.keyboard.press('f')
      await page.keyboard.press(key)
      await expect
        .poll(() => page.evaluate(() => (window as any).__vimplugSent ?? []))
        .toContainEqual({ type: 'openUrl', url: `${base}/tall` })
      expect(page.url()).toBe(`${base}/links`)
    })
  }

  test('an element clickable only by script gets a hint, its wrapper does not', async ({ page }) => {
    await loadEngine(page, `${base}/scripted`)
    await page.keyboard.press('f')
    await page.keyboard.press('j')
    await expect(page).toHaveTitle('clicked')
  })
})

test.describe('panes', () => {
  test('j scrolls the pane under focus, not the unscrollable document', async ({ page }) => {
    await loadEngine(page, `${base}/pane`)
    await page.evaluate(() => document.getElementById('pane')!.focus())
    await page.keyboard.press('j')
    await expect
      .poll(() => page.evaluate(() => document.getElementById('pane')!.scrollTop))
      .toBeGreaterThan(0)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
})

test.describe('input methods', () => {
  test('a composing key does not start a count either', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await composingKey(page, '5', 'Digit5')
    await page.keyboard.press('j')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(60)
  })

  test('a composing Escape does not leave a mode', async ({ page }) => {
    await loadEngine(page, `${base}/tall`)
    await page.keyboard.press('i')
    await expect.poll(async () => (await state(page)).panels).toBe(1)

    await composingKey(page, 'Escape', 'Escape')
    await page.waitForTimeout(200)
    await expect.poll(async () => (await state(page)).panels).toBe(1)
  })
})
