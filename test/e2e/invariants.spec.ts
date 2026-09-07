import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { resolve } from 'node:path'
import { DEFAULT_DSL } from '../../src/shared/config.ts'

const EXT = resolve('dist/chrome')

// Content scripts do not match about:blank or data: URLs, so fixtures need a real origin.
const PAGES: Record<string, string> = {
  '/tall': '<body style="height:5000px">hi</body>',
  '/textarea': '<body style="height:5000px"><textarea id="t"></textarea></body>',
  '/editable': '<body style="height:5000px"><div id="e" contenteditable></div></body>',
  '/shadow': '<body style="height:5000px"><div id="h"></div></body>',
  '/find': `<body>
      <div style="height:2000px">top</div>
      <p id="needle">findmethistext</p>
      <div style="height:2000px">bottom</div>
    </body>`,
  '/links': `<body style="height:5000px">
      <a id="a1" href="/tall">one</a>
      <a id="a2" href="/textarea">two</a>
      <button id="b1" onclick="document.title='clicked'">three</button>
    </body>`,
  '/cmdk': `<body style="height:5000px"><div id="out"></div><script>
      document.addEventListener('keydown', e => {
        if (e.metaKey && e.key === 'k') {
          e.preventDefault()
          document.getElementById('out').textContent = 'page-saw-it'
        }
      })
    </script></body>`,
}

let server: Server
let base: string
let ctx: BrowserContext

async function open(path: string): Promise<Page> {
  const page = await ctx.newPage()
  await page.goto(`${base}${path}`)
  await page.waitForFunction(() => document.documentElement.dataset.vimplug === 'on')
  return page
}

async function activeTabUrl(): Promise<string> {
  const [sw] = ctx.serviceWorkers()
  return await sw!.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true })
    return tabs[0]?.url ?? ''
  })
}

async function setDsl(dsl: string): Promise<void> {
  const [sw] = ctx.serviceWorkers()
  await sw!.evaluate(async (src: string) => {
    await chrome.storage.local.set({ dsl: src })
  }, dsl)
  await new Promise(r => setTimeout(r, 500))
}

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0] ?? ''
    const body = PAGES[path] ?? '<body>not found</body>'
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(`<!doctype html><html>${body}</html>`)
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`

  ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  })
  if (ctx.serviceWorkers().length === 0) await ctx.waitForEvent('serviceworker')
  await new Promise(r => setTimeout(r, 1000))
})

test.afterAll(async () => {
  await ctx?.close()
  await new Promise<void>(r => server.close(() => r()))
})

test('j scrolls the page in normal mode', async () => {
  const page = await open('/tall')
  await page.keyboard.press('j')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.close()
})

test('invariant 1: typing in a textarea does not scroll', async () => {
  const page = await open('/textarea')
  await page.focus('#t')
  await page.keyboard.type('jjjj')
  expect(await page.inputValue('#t')).toBe('jjjj')
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.close()
})

test('invariant 1: typing in a contenteditable does not scroll', async () => {
  const page = await open('/editable')
  await page.focus('#e')
  await page.keyboard.type('jjjj')
  expect(await page.textContent('#e')).toBe('jjjj')
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.close()
})

test('invariant 1: shadow DOM input is treated as editable', async () => {
  const page = await open('/shadow')
  await page.evaluate(() => {
    const host = document.getElementById('h')!
    host.attachShadow({ mode: 'open' }).innerHTML = '<input id="i">'
  })
  await page.evaluate(() => {
    const i = document.getElementById('h')!.shadowRoot!.getElementById('i') as HTMLInputElement
    i.focus()
  })
  await page.keyboard.type('jjjj')
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.close()
})

test('invariant 1: scrolling resumes after leaving the field', async () => {
  const page = await open('/textarea')
  await page.focus('#t')
  await page.keyboard.type('jj')
  await page.evaluate(() => (document.getElementById('t') as HTMLTextAreaElement).blur())
  await page.keyboard.press('j')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.close()
})

test('invariant 2: unbound modifier combos reach the page', async () => {
  const page = await open('/cmdk')
  await page.keyboard.press('Meta+k')
  await expect.poll(() => page.textContent('#out')).toBe('page-saw-it')
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.close()
})

// Playwright's press('H') sends code=KeyH with shiftKey FALSE, which no real keyboard can
// produce. Shifted bindings must be driven as 'Shift+<lowercase>'.
test('shift+k switches to the next tab through the background channel', async () => {
  const first = await open('/tall?1')
  const second = await open('/tall?2')
  await first.bringToFront()

  await expect.poll(activeTabUrl).toContain('?1')
  await first.keyboard.press('Shift+k')
  await expect.poll(activeTabUrl).toContain('?2')

  await first.close()
  await second.close()
})

test('shift+h goes back in history', async () => {
  const page = await open('/tall')
  await page.goto(`${base}/textarea`)
  await page.waitForFunction(() => document.documentElement.dataset.vimplug === 'on')
  expect(page.url()).toContain('/textarea')

  await page.keyboard.press('Shift+h')
  await expect.poll(() => page.url()).toContain('/tall')
  await page.close()
})

test('i suspends the engine until Esc', async () => {
  const page = await open('/tall')
  await page.keyboard.press('i')
  await page.keyboard.press('j')
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  await page.keyboard.press('Escape')
  await page.keyboard.press('j')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.close()
})

test('gi focuses the first text field', async () => {
  const page = await open('/textarea')
  await page.keyboard.press('g')
  await page.keyboard.press('i')
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('t')
  await page.close()
})

test('d scrolls half a viewport', async () => {
  const page = await open('/tall')
  const half = await page.evaluate(() => window.innerHeight / 2)
  await page.keyboard.press('d')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(half - 5)
  await page.close()
})

test('f injects a hint overlay host', async () => {
  const page = await open('/links')
  const before = await page.evaluate(() => document.body.childElementCount)
  await page.keyboard.press('f')
  await expect.poll(() => page.evaluate(() => document.body.childElementCount)).toBe(before + 1)
  await page.keyboard.press('Escape')
  await page.close()
})

test('f then a label activates that element', async () => {
  const page = await open('/links')
  await page.keyboard.press('f')
  await page.waitForTimeout(150)
  // Three targets over the default alphabet means single-character labels a, s, d.
  await page.keyboard.press('d')
  await expect.poll(() => page.title()).toBe('clicked')
  await page.close()
})

test('f then Escape leaves no overlay behind', async () => {
  const page = await open('/links')
  const before = await page.evaluate(() => document.body.childElementCount)
  await page.keyboard.press('f')
  await page.waitForTimeout(150)
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => document.body.childElementCount)).toBe(before)
  await page.close()
})

test('invariant 1 holds for hint mode: f does not fire while typing', async () => {
  const page = await open('/textarea')
  await page.focus('#t')
  await page.keyboard.type('ffff')
  expect(await page.inputValue('#t')).toBe('ffff')
  expect(await page.evaluate(() => document.body.childElementCount)).toBe(1)
  await page.close()
})

test('? opens the help overlay and Esc closes it', async () => {
  const page = await open('/tall')
  const before = await page.evaluate(() => document.body.childElementCount)

  await page.keyboard.press('Shift+/')
  await expect.poll(() => page.evaluate(() => document.body.childElementCount)).toBe(before + 1)
  expect(
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.vimplugUi),
  ).toBe('')

  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => document.body.childElementCount)).toBe(before)
  await page.close()
})

test('typing in an overlay does not reach the engine', async () => {
  const page = await open('/tall')
  await page.keyboard.press('Shift+/')
  await page.waitForTimeout(200)
  await page.keyboard.type('jjjj')
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.keyboard.press('Escape')
  await page.close()
})

test('o accepts spaces and searches (vimkey #26)', async () => {
  await setDsl(`${DEFAULT_DSL}\nset searchEngine = ${base}/search?q=%s`)
  const page = await open('/tall')

  await page.keyboard.press('o')
  await page.waitForTimeout(200)
  await page.keyboard.type('hello world')
  await page.keyboard.press('Enter')

  await expect.poll(() => page.url()).toContain('q=hello%20world')
  await page.close()
  await setDsl(DEFAULT_DSL)
})

test('o navigates to a bare domain as a url', async () => {
  const page = await open('/tall')
  await page.keyboard.press('o')
  await page.waitForTimeout(200)
  await page.keyboard.type(`127.0.0.1:${new URL(base).port}/textarea`)
  await page.keyboard.press('Enter')
  await expect.poll(() => page.url()).toContain('/textarea')
  await page.close()
})

test('hints filter by link text (vimkey #16)', async () => {
  const page = await open('/links')
  await page.keyboard.press('f')
  await page.waitForTimeout(150)
  // "t" narrows to two/three by text, "h" leaves only three, which fires at once.
  await page.keyboard.type('th')
  await expect.poll(() => page.title()).toBe('clicked')
  await page.close()
})

test('/ finds text and scrolls it into view (vimkey #24)', async () => {
  const page = await open('/find')
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  await page.keyboard.press('/')
  await page.waitForTimeout(200)
  await page.keyboard.type('findmethistext')

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)
  await page.keyboard.press('Escape')
  await page.close()
})

test('find leaves no element behind in the page tree', async () => {
  const page = await open('/find')
  const before = await page.evaluate(() => document.body.innerHTML.length)
  await page.keyboard.press('/')
  await page.waitForTimeout(200)
  await page.keyboard.type('findme')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => document.body.innerHTML.length)).toBe(before)
  await page.close()
})

test('M sets a mark and ` returns to it', async () => {
  const page = await open('/tall')
  await page.evaluate(() => window.scrollTo(0, 1200))
  await page.keyboard.press('Shift+m')
  await page.keyboard.press('a')
  await page.waitForTimeout(200)

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.keyboard.press('`')
  await page.keyboard.press('a')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1200)
  await page.close()
})

test('a mark waiting for a letter releases on a bad key', async () => {
  const page = await open('/tall')
  await page.keyboard.press('Shift+m')
  await page.keyboard.press('1')
  await page.keyboard.press('j')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.close()
})

test('v selects text and y yanks it', async () => {
  const page = await open('/find')
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })

  await page.keyboard.press('v')
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('l')
  expect(await page.evaluate(() => window.getSelection()?.toString().length ?? 0)).toBe(6)

  await page.keyboard.press('y')
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toHaveLength(6)
  await page.close()
})

test('v then Escape clears the selection', async () => {
  const page = await open('/find')
  await page.keyboard.press('v')
  await page.keyboard.press('l')
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('')
  await page.close()
})

test('the command palette runs an action by name', async () => {
  const page = await open('/tall')
  await page.keyboard.press('Shift+;')
  await page.waitForTimeout(200)
  await page.keyboard.type('half a page down')
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.close()
})

test('invariant 3: a disabled host never activates the engine', async () => {
  await setDsl('site 127.0.0.1 {\n  disable\n}')
  const page = await ctx.newPage()
  await page.goto(`${base}/tall`)
  await page.waitForTimeout(700)
  expect(await page.evaluate(() => document.documentElement.dataset.vimplug)).toBeUndefined()
  await page.keyboard.press('j')
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.close()
  await setDsl(DEFAULT_DSL)
})
