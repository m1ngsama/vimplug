# vimplug

Keyboard-driven browser control for Safari and Chrome.

## Requirements

- Safari 16.4+ (macOS 13.3+), or Chrome/Edge
- Node 26+, pnpm

## Development

```sh
pnpm install
pnpm check         # tsc --noEmit
pnpm test          # unit tests, no build step
pnpm build         # produces dist/chrome and dist/safari
pnpm test:e2e      # builds, then drives the artifact in a real Chromium
```

Unit tests run on Node's built-in test runner straight from TypeScript, so there is no
test framework and no compile step. End-to-end tests load `dist/chrome` into Chromium and
exercise the built artifact, never a dev server.

Load `dist/chrome` via `chrome://extensions` -> Load unpacked. For Safari see
[docs/SAFARI.md](docs/SAFARI.md).

## Keys

Defaults. Every one of them is rebindable; `?` shows the bindings actually in force.

| Keys | Action |
| --- | --- |
| `j` `k` `h` `l` | Scroll |
| `d` `u` | Scroll half a page |
| `f` | Hint clickable elements |
| `F` | Hint, opening links in a new tab |
| `o` | Open a URL or search |
| `T` | Search open tabs |
| `t` | New tab |
| `J` `K` | Previous / next tab |
| `H` `L` | Back / forward |
| `r` `x` `X` | Reload, close, reopen tab |
| `yt` | Duplicate tab |
| `yy` | Copy the page URL |
| `p` `P` | Open the clipboard URL here / in a new tab |
| `gi` | Focus the first text field |
| `gf` | Focus an iframe by hint |
| `i` | Suspend vimplug until Esc |
| `-` `=` `m` | Media volume down, up, mute |
| `?` | Keyboard help |
| `<Esc>` | Leave the current mode |
| `:` | Run any action by name |
| `/` `n` `N` | Find in page, next, previous |
| `M` `` ` `` | Set a mark, jump to it |
| `v` | Visual mode |

`m` stays vimkey's mute, so marks use `M` and `` ` `` instead of vim's `m`.

During `f`, characters that are not a hint label narrow the hints by link text, and the
last remaining candidate fires on its own.

In visual mode `h` `j` `k` `l` `w` `b` `0` `$` extend the selection, `y` copies it, and
`<Esc>` cancels.

## Configuration

The settings page has two views over one configuration. **Keys** lists every action with
its key; click a key and press the one you want. **Text** is the same configuration as
text. The Keys view edits that text in place through the parser's source spans, so your
comments and layout survive a rebind.

Bindings and options are one block of text, stored as written so comments survive edits.

```
map <C-d> scrollHalfDown

map <C-[> escape
map <Esc>  escape

site youtube.com {
  unmap j
  unmap k
}

site mail.google.com {
  disable
}

set hintChars = "asdfghjkl"
set keyMatching = physical
```

`keyMatching = physical` (the default) matches the physical key position, so bindings
survive a Chinese IME or a Dvorak layout. Set it to `logical` to match the produced
character instead.

Where two `site` blocks match one host, the more specific pattern wins; ties go to
whichever appears last.

## Engine invariants

Three properties hold by construction and are covered by regression tests. Changing any of
them is a behaviour change, not a refactor.

1. **No keydown listener exists in insert mode.** The mode machine is the only thing that
   attaches or detaches it, so typing in a text field has zero overhead.
2. **Modifier combos pass through unless explicitly bound.** Cmd+K, Cmd+I and Cmd+B stay
   with the page.
3. **A disabled host never activates the engine.** Chrome excludes it from injection
   outright; Safari loads a fail-closed bootstrap that confirms the host first.

A fourth property holds for the same reason: **one engine per frame.** Saving settings
re-registers content scripts and can deliver the engine to a loading page twice, which
would double every keystroke. A flag in the extension's isolated world prevents it.

## Budget

`content.js` must stay under 30KB gzip. `pnpm build` fails if it does not.

## License

Not yet decided.
