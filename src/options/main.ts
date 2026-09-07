import './style.css'
import { ACTIONS, type ActionGroup } from '../shared/actions.ts'
import { readDsl, writeDsl } from '../shared/storage.ts'
import { resolveForHost, disabledHosts, DEFAULT_DSL, OPTION_SCHEMA } from '../shared/config.ts'
import { parse } from '../shared/dsl/parse.ts'
import { toNotation } from '../shared/keys.ts'
import { fromEvent } from '../content/event-keys.ts'
import { rebind, unbind, setOption, toggleSite } from './edits.ts'
import { labelFor } from './labels.ts'

const GROUPS: ActionGroup[] = ['Scroll', 'Navigation', 'Tabs', 'Open', 'Media', 'Modes']

let src = ''
let view: 'keys' | 'text' = 'keys'
let capturing: string | null = null

const app = document.body
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] => {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}

let statusNode: HTMLElement

async function save(next: string): Promise<void> {
  src = next
  await writeDsl(src)
  statusNode.textContent = 'Saved'
  setTimeout(() => (statusNode.textContent = ''), 1400)
}

function bindingsByAction(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const b of resolveForHost(src, 'example.com').bindings.normal) {
    if (b.notation) out.set(b.action, [...(out.get(b.action) ?? []), b.notation])
  }
  return out
}

function keysView(): HTMLElement {
  const bound = bindingsByAction()

  const owners = new Map<string, string[]>()
  for (const [action, notations] of bound) {
    for (const n of notations) owners.set(n, [...(owners.get(n) ?? []), action])
  }

  const main = el('main')
  main.append(
    el('p', { className: 'note' }, [
      'Click a key to rebind it, then press the key you want. Press Escape to cancel. ' +
        'Bindings match the physical key position, so they hold under an IME or a non-QWERTY layout.',
    ]),
  )

  for (const group of GROUPS) {
    main.append(el('h2', { textContent: group }))
    for (const action of ACTIONS.filter(a => a.group === group)) {
      const notation = bound.get(action.id)?.[0]
      const conflict = notation && (owners.get(notation)?.length ?? 0) > 1

      const cap = el('button', {
        className: 'cap',
        textContent: capturing === action.id ? 'Press a key' : (notation ?? 'Not bound'),
      })
      if (capturing === action.id) cap.dataset.capturing = ''
      if (!notation) cap.dataset.unbound = ''
      cap.addEventListener('click', () => {
        capturing = capturing === action.id ? null : action.id
        render()
      })

      const clear = el('button', { className: 'clear', textContent: 'Clear' })
      clear.addEventListener('click', () => void save(unbind(src, action.id)).then(render))

      const label = el('span', {}, [
        action.description,
        ...(conflict
          ? [el('span', { className: 'conflict', textContent: `  also bound to another action` })]
          : []),
      ])

      main.append(el('div', { className: 'row' }, [cap, label, notation ? clear : el('span')]))
    }
  }

  main.append(el('h2', { textContent: 'Settings' }))
  const opts = resolveForHost(src, 'example.com').options
  for (const def of OPTION_SCHEMA) {
    const current = String(opts[def.key])
    let field: HTMLElement

    if (def.type === 'boolean') {
      const box = el('input', { type: 'checkbox', checked: opts[def.key] === true })
      box.addEventListener('change', () =>
        void save(setOption(src, def.key, String(box.checked))).then(render),
      )
      field = box
    } else if (def.type === 'choice') {
      const select = el(
        'select',
        {},
        (def.choices ?? []).map(c => el('option', { value: c, textContent: c })),
      )
      select.value = current
      select.addEventListener('change', () =>
        void save(setOption(src, def.key, select.value)).then(render),
      )
      field = select
    } else {
      const input = el('input', { type: def.type === 'number' ? 'number' : 'text', value: current })
      input.addEventListener('change', () =>
        void save(setOption(src, def.key, input.value)).then(render),
      )
      field = input
    }

    main.append(
      el('label', { className: 'opt' }, [
        el('span', {}, [labelFor(def.key).label, el('small', { textContent: labelFor(def.key).help })]),
        field,
      ]),
    )
  }

  main.append(
    el('h2', { textContent: 'Disabled sites' }),
    el('p', { className: 'note' }, [
      'vimplug is never loaded on these sites, so their own shortcuts keep working.',
    ]),
  )

  const hosts = disabledHosts(src)
  main.append(
    el(
      'div',
      { className: 'sites' },
      hosts.map(h => {
        const remove = el('button', { textContent: '×', title: `Enable ${h}` })
        remove.addEventListener('click', () => void save(toggleSite(src, h, false)).then(render))
        return el('span', { className: 'site' }, [h, remove])
      }),
    ),
  )

  const input = el('input', { type: 'text', placeholder: 'example.com or *.example.com' })
  const form = el('form', { className: 'add' }, [
    input,
    el('button', { type: 'submit', textContent: 'Add site' }),
  ])
  form.addEventListener('submit', e => {
    e.preventDefault()
    const host = input.value.trim()
    if (host) void save(toggleSite(src, host, true)).then(render)
  })
  main.append(form)

  return main
}

function textView(): HTMLElement {
  const area = el('textarea', { value: src, spellcheck: false })
  const errors = el('ul', { className: 'errors' })

  const check = () => {
    const found = parse(area.value).errors
    errors.replaceChildren(
      ...found.map(e =>
        el('li', {}, [el('b', { textContent: `line ${e.line}` }), e.message]),
      ),
    )
  }

  area.addEventListener('input', check)
  area.addEventListener('blur', () => void save(area.value))

  const reset = el('button', { className: 'reset', textContent: 'Restore defaults' })
  reset.addEventListener('click', () => void save(DEFAULT_DSL).then(render))

  const main = el('main', {}, [
    el('p', { className: 'note' }, [
      'This text is the configuration. The Keys view edits it in place, so your comments ' +
        'and layout survive. Changes save when you click away.',
    ]),
    area,
    errors,
    el('h2', { textContent: 'Start over' }),
    reset,
  ])
  check()
  return main
}

function render(): void {
  statusNode = statusNode ?? el('span', { className: 'status' })

  const tab = (id: 'keys' | 'text', text: string) => {
    const b = el('button', { textContent: text })
    b.setAttribute('aria-selected', String(view === id))
    b.addEventListener('click', () => {
      view = id
      capturing = null
      render()
    })
    return b
  }

  app.replaceChildren(
    el('header', { className: 'bar' }, [
      el('h1', { textContent: 'vimplug' }),
      statusNode,
      el('nav', { className: 'tabs' }, [tab('keys', 'Keys'), tab('text', 'Text')]),
    ]),
    view === 'keys' ? keysView() : textView(),
  )
}

// Capture runs on the window so a rebind can claim keys the browser would otherwise
// route to the focused control.
window.addEventListener(
  'keydown',
  e => {
    if (!capturing) return
    e.preventDefault()
    e.stopPropagation()

    const action = capturing
    capturing = null
    if (e.key === 'Escape') {
      render()
      return
    }
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
      capturing = action
      return
    }
    void save(rebind(src, action, toNotation(fromEvent(e)))).then(render)
  },
  true,
)

async function main(): Promise<void> {
  src = await readDsl()
  render()
}

void main()
