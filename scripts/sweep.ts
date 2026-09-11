import { webkit, type Page } from '@playwright/test'
import { loadEngine } from '../test/engine/harness.ts'

// Fixtures cover what we thought of. These are pages we did not write, and one pass over
// them has found defects the whole fixture suite missed. Not a CI job: it needs the
// network, and someone else's redesign would turn it red for no reason.
const SITES: Array<[name: string, url: string, query: string]> = [
  ['GitHub PR', 'https://github.com/m1ngsama/vimplug/pull/9', 'files'],
  ['Wikipedia', 'https://en.wikipedia.org/wiki/Vim_(text_editor)', 'editor'],
  ['MDN', 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent', 'value'],
  ['Hacker News', 'https://news.ycombinator.com/', 'comments'],
  ['V2EX', 'https://www.v2ex.com/', 'explore'],
]

const NONSENSE = 'adlkajhflkjahdslkf'

interface State {
  panels: number
  ours: boolean
  y: number
  hints: number
}

const look = (page: Page): Promise<State> =>
  page.evaluate(() => {
    const deep = (r: Document | ShadowRoot): Element | null => {
      const el = r.activeElement
      return el?.shadowRoot?.activeElement ? deep(el.shadowRoot) : el
    }
    const a = deep(document)
    return {
      panels: document.querySelectorAll('[data-vimplug-ui]').length,
      ours: a instanceof HTMLElement && 'vimplugUi' in a.dataset,
      y: Math.round(window.scrollY),
      // Counting every body child flakes: V2EX adds ad iframes while hints are up.
      hints: [...document.body.children].filter(
        c => c instanceof HTMLElement && c.style.zIndex === '2147483647' && !('vimplugUi' in c.dataset),
      ).length,
    }
  })

const pause = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

async function check(page: Page, query: string): Promise<string[]> {
  const bad: string[] = []

  await page.keyboard.press('/')
  await pause(700)
  let s = await look(page)
  if (s.panels !== 1) bad.push(`/ opened ${s.panels} panels`)
  if (!s.ours) bad.push('/ did not take focus')

  await page.keyboard.type(query, { delay: 50 })
  await pause(700)
  if (!(await look(page)).ours) bad.push('focus left the panel while typing')
  const leaked = await page.evaluate(
    q =>
      [...document.querySelectorAll<HTMLInputElement>('input,textarea')].some(i =>
        i.value?.includes(q),
      ),
    query,
  )
  if (leaked) bad.push('the query reached a field on the page')

  await page.keyboard.press('Enter')
  await pause(700)
  s = await look(page)
  if (s.panels !== 0) bad.push('Enter left the panel open')
  const committed = s.y

  await page.keyboard.press('j')
  await pause(600)
  if ((await look(page)).y <= committed) bad.push('normal mode did not resume after Enter')

  await page.keyboard.press('/')
  await pause(500)
  const before = (await look(page)).y
  await page.keyboard.type(NONSENSE, { delay: 15 })
  await pause(700)
  s = await look(page)
  // scrollTo can land a sub-pixel away from where it was asked for.
  if (Math.abs(s.y - before) > 2) bad.push(`a query with no match moved the page to ${s.y}`)
  await page.keyboard.press('Escape')
  await pause(400)

  const hints = (await look(page)).hints
  await page.keyboard.press('f')
  await pause(700)
  if ((await look(page)).hints !== hints + 1) bad.push('f drew no hints')
  await page.keyboard.press('Escape')
  await pause(500)
  if ((await look(page)).hints !== hints) bad.push('Escape left hints behind')

  return bad
}

const browser = await webkit.launch()
let failed = 0

for (const [name, url, query] of SITES) {
  const page = await browser.newPage()
  let bad: string[] = []
  try {
    await loadEngine(page, url)
    await pause(3000)
    bad = await check(page, query)
  } catch (err) {
    bad = [`threw: ${String(err).split('\n')[0]}`]
  }
  if (bad.length === 0) console.log(`  ok   ${name}`)
  else {
    failed += 1
    console.log(`  FAIL ${name}`)
    for (const b of bad) console.log(`         ${b}`)
  }
  await page.close()
}

await browser.close()
console.log(`\n${SITES.length - failed} of ${SITES.length} sites clean`)
process.exit(failed > 0 ? 1 : 0)
