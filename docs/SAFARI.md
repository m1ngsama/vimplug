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

## Known gaps

- No icons yet, so the converter cannot populate the app icon set.
- Safari extensions cannot be driven by Playwright. The automated invariant tests run
  against Chrome only; the Safari equivalents are a manual checklist.
