import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'
import { DEFAULT_DSL } from '../../src/shared/config.ts'

// The Safari artifact, because Safari is what this extension is for. Playwright's WebKit
// cannot load extensions, so the engine is injected and the few chrome.* calls it makes
// are shimmed. That trades away the extension plumbing — which only real Safari can
// exercise — and keeps WebKit's real DOM, focus, event and IME semantics.
const ENGINE = readFileSync(resolve('dist/safari/content.js'), 'utf8')

// addInitScript runs before documentElement exists; a content script at document_start
// runs just after it. Without this wait the engine throws on document.documentElement.
function atDocumentStart(src: string): string {
  return `(() => {
    const run = () => { ${src} }
    if (document.documentElement) run()
    else new MutationObserver((_, o) => {
      if (document.documentElement) { o.disconnect(); run() }
    }).observe(document, { childList: true })
  })()`
}

// getDsl must answer with a real config: loadDsl only falls back to DEFAULT_DSL when the
// reply is not a string, so returning '' would look like a valid config with no bindings.
function shim(dsl: string): string {
  return `
    window.__vpMessages = []
    window.chrome = {
      runtime: {
        getURL: (p) => p,
        sendMessage: async (msg) => {
          window.__vpMessages.push(msg)
          if (msg.type === 'getDsl') return { dsl: ${JSON.stringify(dsl)} }
          if (msg.type === 'siteEnabled') return { enabled: true }
          if (msg.type === 'suggest') return { rows: [] }
          if (msg.type === 'listTabs') return { tabs: [] }
          return {}
        },
      },
      storage: {
        local: { get: async () => ({}), set: async () => {} },
        onChanged: { addListener() {} },
      },
    }`
}

export const PAGES: Record<string, string> = {
  '/tall': '<body style="height:5000px">hi</body>',
  '/textarea': '<body style="height:5000px"><textarea id="t"></textarea></body>',
  '/editable': '<body style="height:5000px"><div id="e" contenteditable></div></body>',
  // No query used by a test may appear here, or a working find is indistinguishable from
  // a leaked scroll command. A fixture containing "jjjj" once faked a passing repro.
  '/find': `<body>
      <div style="height:2000px">top</div>
      <p id="needle">needlexyz</p>
      <div style="height:2000px">bottom</div>
    </body>`,
  '/links': `<body style="height:5000px">
      <a id="a1" href="/tall">one</a>
      <a id="a2" href="/textarea">two</a>
      <button id="b1" onclick="document.title='clicked'">three</button>
    </body>`,
  '/shadow': '<body style="height:5000px"><div id="h"></div></body>',
  // The shape of a site that focuses its own search box on load. vimplug must go quiet.
  '/steals': `<body style="height:5000px"><input id="s">
      <script>document.getElementById('s').focus()</script></body>`,
  '/cmdk': `<body style="height:5000px"><div id="out"></div><script>
      document.addEventListener('keydown', e => {
        if (e.metaKey && e.key === 'k') {
          e.preventDefault()
          document.getElementById('out').textContent = 'page-saw-it'
        }
      })</script></body>`,
  // A match split across text nodes, and characters a regex would read as syntax.
  '/awkward': `<body>
      <div style="height:2000px">top</div>
      <p id="split">wo<span>rd</span>break</p>
      <p id="meta">cost is $5.00 (approx) [sic] a+b*c</p>
      <div style="height:2000px">bottom</div>
    </body>`,
  '/pane': `<body style="margin:0;height:100vh;overflow:hidden">
      <div id="pane" style="height:100vh;overflow-y:auto" tabindex="0">
        <div style="height:5000px">pane content</div>
      </div>
    </body>`,
}

export async function serveFixtures(): Promise<{ base: string; stop(): Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0] ?? ''
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(`<!doctype html><html>${PAGES[path] ?? '<body>not found</body>'}</html>`)
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  return {
    base: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>(r => server.close(() => r())),
  }
}

export async function loadEngine(page: Page, url: string, dsl = DEFAULT_DSL): Promise<void> {
  await page.addInitScript({ content: shim(dsl) })
  await page.addInitScript({ content: atDocumentStart(ENGINE) })
  await page.goto(url)
  await page.waitForFunction(() => document.documentElement.dataset.vimplug === 'on')
}

export interface EngineState {
  panels: number
  scrollY: number
  /** True when the focused element is one of ours, so the page cannot see the keystrokes. */
  focusInOverlay: boolean
  messages: string[]
}

export function state(page: Page): Promise<EngineState> {
  return page.evaluate(() => ({
    panels: document.querySelectorAll('[data-vimplug-ui]').length,
    scrollY: window.scrollY,
    focusInOverlay:
      document.activeElement instanceof HTMLElement &&
      'vimplugUi' in document.activeElement.dataset,
    messages: (window as unknown as { __vpMessages: Array<{ type: string }> }).__vpMessages
      .filter(m => m.type !== 'getDsl')
      .map(m => m.type),
  }))
}

/**
 * Dispatches the keydown an IME sends mid-composition. Every mainstream vim extension
 * drops these; a real Pinyin keyboard cannot be driven through Playwright, and keyCode is
 * the part Safari still sets when it fires compositionend before the final keydown.
 */
export function composingKey(page: Page, key: string, code: string): Promise<void> {
  return page.evaluate(
    ([k, c]) => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: k,
          code: c,
          keyCode: 229,
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      )
    },
    [key, code],
  )
}
