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
