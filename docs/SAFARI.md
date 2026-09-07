# Safari

## Requirements

Safari 16.4+ (macOS 13.3+). `scripting.registerContentScripts` landed in 16.4 and the
engine depends on it.

## Generating the Xcode project

The project is generated once and committed. It is only regenerated when the set of
files in `dist/safari` changes (adding a new entry point, for example).

```sh
pnpm build:safari
xcrun safari-web-extension-converter dist/safari \
  --project-location xcode \
  --app-name vimplug \
  --bundle-identifier space.m1ng.vimplug \
  --swift --macos-only --no-prompt --no-open
```

**Do not pass `--copy-resources`.** Without it the project *references* `dist/safari`
(`path = ../../../dist/safari/content.js` in `project.pbxproj`) instead of copying it, so
a `pnpm build:safari` is picked up by the next Xcode build with no sync step. Passing
`--copy-resources` snapshots the files and you get stale extension code that looks like a
caching bug.

Adding a new file to `dist/safari` means adding it to the Xcode project too — the project
enumerates the files it references at generation time.

## Building

```sh
pnpm build:safari
xcodebuild -project xcode/vimplug/vimplug.xcodeproj -scheme vimplug \
  -configuration Debug -destination 'platform=macOS' CODE_SIGNING_ALLOWED=NO build
```

The built app lands in `~/Library/Developer/Xcode/DerivedData/vimplug-*/Build/Products/Debug/`.
Extension resources are bundled at `vimplug.app/Contents/PlugIns/vimplug Extension.appex/Contents/Resources/`.

## Enabling in Safari

1. Run the host app once (open `vimplug.app`, or Run the scheme in Xcode).
2. Safari > Settings > Advanced > check "Show features for web developers".
3. Safari > Develop > check "Allow Unsigned Extensions". This resets on every Safari restart.
4. Safari > Settings > Extensions > enable vimplug, then grant site access.

Background console: Safari > Develop > Web Extension Background Content > vimplug.

## Manifest fields Safari rejects

`safari-web-extension-converter` warns about unsupported manifest keys. Findings so far,
each pinned by a test in `src/shared/manifest-def.test.ts`:

| Field | Status |
| --- | --- |
| `background.type: "module"` | Rejected. Background is built as IIFE for both targets. |
| `options_ui.open_in_tab` | Ignored. Emitted for Chrome only. |

## `excludeMatches` is ignored

Safari accepts `scripting.registerContentScripts` but silently ignores `excludeMatches`
(FB16590857), so disabled sites cannot be expressed the way they are on Chrome. Safari
instead loads `bootstrap.js`, which confirms the site is enabled before importing the
engine, and does nothing if it cannot confirm. See `src/background/injection.ts`.

## Manual checklist

Safari extensions cannot be driven by Playwright, so the automated invariant suite covers
Chrome only. These steps mirror `test/e2e/invariants.spec.ts` one for one and must be run
by hand against Safari before a release.

Serve the fixtures over HTTP — content scripts do not match `about:blank` or `data:` URLs:

```sh
pnpm build:safari
python3 -m http.server 8000
```

| # | Mirrors | Steps | Expected |
| --- | --- | --- | --- |
| 1 | `j scrolls the page` | Open a long page, press `j` | Page scrolls down |
| 2 | invariant 1, textarea | Focus a `<textarea>`, type `jjjj` | Field reads `jjjj`, page does not scroll |
| 3 | invariant 1, contenteditable | Focus a `contenteditable`, type `jjjj` | Text inserted, page does not scroll |
| 4 | invariant 1, shadow DOM | Focus an `<input>` inside an open shadow root, type `jjjj` | Page does not scroll |
| 5 | invariant 1, resume | Blur the field, press `j` | Page scrolls again |
| 6 | invariant 2 | On a page binding Cmd+K, press Cmd+K | The page's own handler runs |
| 7 | invariant 3 | Add `site <host> { disable }`, reload | `document.documentElement.dataset.vimplug` is undefined and `j` does nothing |

Check 7 is the one that differs by platform: Chrome never injects, while Safari injects
`bootstrap.js` and stops there. Both must end with no listener and no DOM changes.

## Known gaps

- No icons yet, so the converter cannot populate the app icon set.
- Safari extensions cannot be driven by Playwright. The automated invariant tests run
  against Chrome only; the Safari equivalents are a manual checklist.
