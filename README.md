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

## Engine invariants

Three properties hold by construction and are covered by regression tests. Changing any of
them is a behaviour change, not a refactor.

1. **No keydown listener exists in insert mode.** The mode machine is the only thing that
   attaches or detaches it, so typing in a text field has zero overhead.
2. **Modifier combos pass through unless explicitly bound.** Cmd+K, Cmd+I and Cmd+B stay
   with the page.
3. **A disabled host never activates the engine.** Chrome excludes it from injection
   outright; Safari loads a fail-closed bootstrap that confirms the host first.

## Budget

`content.js` must stay under 30KB gzip. `pnpm build` fails if it does not.

## License

Not yet decided.
