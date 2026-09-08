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

## Loading for development

Recent Safari loads an unpacked extension directly, with no host app involved. Prefer this
while developing; the Xcode project is for distribution.

1. Safari > Settings > Advanced > check "Show features for web developers".
2. Safari > Settings > Developer > check "Allow unsigned extensions". This resets whenever
   Safari restarts.
3. Safari > Settings > Developer > "Add Temporary Extension…", then pick the `dist/safari`
   directory itself, not a file inside it.
4. Safari > Settings > Extensions > enable vimplug and set site access to "Always Allow on
   Every Website". Without site access `registerContentScripts` silently injects nothing,
   which looks identical to a broken build.

To test the packaged form instead, run the host app once (open `vimplug.app`, or Run the
scheme in Xcode) and then enable it under Extensions as above.

Background console: Safari > Develop > Web Extension Background Content > vimplug.

**Checking that the background worker runs:** the background is the only thing that
registers content scripts, so behaviour answers the question directly. If `j` scrolls a
long page, the worker ran. If nothing responds anywhere, it did not, and `background`
needs to become `{ scripts: ['background.js'], persistent: false }` in
`src/shared/manifest-def.ts`. The build already emits background as IIFE, so no build
change is needed for that switch.

## Manifest fields Safari rejects

`safari-web-extension-converter` warns about unsupported manifest keys. Findings so far,
each pinned by a test in `src/shared/manifest-def.test.ts`:

| Field | Status |
| --- | --- |
| `background.type: "module"` | Rejected. Background is built as IIFE for both targets. |
| `options_ui.open_in_tab` | Ignored. Emitted for Chrome only. |
| `history`, `bookmarks`, `sessions` permissions | Rejected. Requested for Chrome only. |

Without those three permissions Safari degrades rather than breaks: `o` still searches
open tabs and still opens URLs and searches, but offers no history or bookmarks; `b` finds
nothing; and `X` cannot reopen a closed tab. Every call is guarded, so the absent APIs
produce empty results instead of errors.

## `excludeMatches` is ignored

Safari accepts `scripting.registerContentScripts` but silently ignores `excludeMatches`
(FB16590857), so disabled sites cannot be expressed the way they are on Chrome. Safari
instead loads `bootstrap.js`, which confirms the site is enabled before importing the
engine, and does nothing if it cannot confirm. See `src/background/injection.ts`.

## Manual checklist

Safari extensions cannot be driven by Playwright, and safaridriver cannot load an
extension at all. But Safari is WebKit, and `pnpm test:engine` runs the engine in WebKit,
so scrolling, modes, focus, counts, hints, overlays, find and input-method handling are
all covered automatically. What is left here is the part that is not the engine: Safari's
own extension plumbing, which nothing but Safari can answer for.

Run these by hand before a release, with the extension loaded per "Loading for
development" above. Serve fixtures over HTTP — content scripts do not match `about:blank`
or `data:` URLs:

```sh
pnpm build:safari
python3 -m http.server 8000
```

| # | What only Safari can answer | Steps | Expected |
| --- | --- | --- | --- |
| 1 | The background worker runs at all | Open a long page, press `j` | The page scrolls. The background is the only thing that registers content scripts, so if nothing responds anywhere it never started, and `background` must become `{ scripts: ['background.js'], persistent: false }` in `src/shared/manifest-def.ts`. The build already emits IIFE, so no build change is needed. |
| 2 | The fail-closed bootstrap | Add `site <host> { disable }`, reload | `document.documentElement.dataset.vimplug` is undefined and `j` does nothing. This is the check that differs by platform: Chrome never injects, Safari injects `bootstrap.js` and stops there. |
| 3 | The settings page is reachable | Settings > Extensions > vimplug > Settings | The page opens. Safari ignores `open_in_tab`, so this button is the only way in. |
| 4 | Settings reach the page | Rebind "Scroll down" to `d`, then export from Text, edit the file, import it back | The rebind works on any page and the edited configuration is in force |
| 5 | The toolbar button | Click it on any site | The badge reads `off`, the page reloads, keys do nothing; clicking again restores it. No automated counterpart on any platform: Playwright drives pages, not the browser's own toolbar. |
| 6 | Permissions Safari withholds | Press `o` and type part of an open tab's title; then press `b`; then `X` | The tab is offered and Enter switches to it. `b` finds nothing and `X` cannot reopen a tab, and neither throws — Safari grants no `history`, `bookmarks` or `sessions`. |
| 7 | Storage survives a restart | Scroll down, press `Ma`, quit and reopen Safari, press `` `a `` | The position is restored |

Check 1 has been open since the project started and is the reason this table still exists.

Find highlighting depends on the CSS Custom Highlight API, which Safari has from 17.2. On
anything older the panel still opens and still scrolls to matches, and only the painting
is skipped; `pnpm test:engine` covers that fallback.

## Known gaps

- Safari extensions cannot be driven by Playwright, and safaridriver cannot load one. The
  engine is covered in WebKit instead; Safari's extension plumbing stays a manual list.
- iOS and iPadOS are not supported.
