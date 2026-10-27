# Safari

## Requirements

Safari 16.4+ (macOS 13.3+). `scripting.registerContentScripts` landed in 16.4 and the
engine depends on it. iOS and iPadOS are not supported.

## Installing

README has the steps for the prebuilt app. Building it yourself needs Xcode — Safari loads
a web extension only from inside an app bundle, and only Xcode builds one.

```sh
pnpm install && pnpm build:app
```

That leaves `dist/vimplug.app`, a universal binary, ad-hoc signed and stamped with the
version from `package.json`. Copy it over the installed app and open it once; the app's
only job is to register the extension with Safari.

```sh
ditto dist/vimplug.app /Applications/vimplug.app
```

The app is signed ad-hoc rather than left unsigned because entitlements are only written
when something signs, and Safari will not load an appex that lost its sandbox entitlement.
An ad-hoc signature satisfies Safari but not Gatekeeper, so a copy that reaches a Mac
through a browser or AirDrop arrives quarantined and is refused. `curl` does not
quarantine what it downloads, which is why README installs with it;
`xattr -dr com.apple.quarantine /Applications/vimplug.app` clears a copy that was.

To sign with an [Apple Development certificate](https://developer.apple.com/help/account/certificates/certificates-overview)
instead, pass its team ID. Safari then keeps the extension across restarts without "Allow
unsigned extensions". Xcode > Settings > Accounts creates the certificate, and the team ID
is the `OU` in its subject.

```sh
security find-certificate -c "Apple Development" -p | openssl x509 -noout -subject
DEVELOPMENT_TEAM=<team id> pnpm build:app
```

`pnpm package:app` zips the app as `dist/vimplug-safari.zip`. The Release workflow runs it
on a macOS runner and attaches the zip to each published release.

## Distribution and signing

The release build is ad-hoc signed, so "Allow unsigned extensions" must be re-ticked at
every Safari launch. Tracked in [#10](https://github.com/m1ngsama/vimplug/issues/10). The
facts, current as of Safari 26:

- **Only two ways exist to ship a build that installs permanently**: the Mac App Store, or
  an app signed with a Developer ID certificate and notarized. Both require the $99/year membership; Developer
  ID certificates and `notarytool` are issued to paid members only.
- **Developer ID works outside the App Store as of Safari 18.4** (macOS 15.4). Before that,
  App Store distribution was the only route that avoided the unsigned-extensions toggle, so
  older answers saying otherwise are out of date. This matters here: it means shipping a
  signed `.app` from a GitHub release, with no App Store review and no GPL conflict.
- **An Apple Development certificate works only on the Mac that holds it.** Safari accepts
  the build as signed, but Gatekeeper rejects it everywhere else.

### Opt-in Developer ID builds

The public release remains ad-hoc signed. To build with an existing Developer ID
Application certificate, provide its full name and matching team:

```sh
DEVELOPMENT_TEAM=ABCDE12345 \
DEVELOPER_ID_APPLICATION="Developer ID Application: Example Company (ABCDE12345)" \
pnpm build:app
```

This enables secure timestamps and explicit distribution entitlements without
`get-task-allow`. It does not notarize the app. Only adding `NOTARY_PROFILE` submits it to
Apple, using credentials already stored with `notarytool store-credentials`:

```sh
DEVELOPMENT_TEAM=ABCDE12345 \
DEVELOPER_ID_APPLICATION="Developer ID Application: Example Company (ABCDE12345)" \
NOTARY_PROFILE=vimplug-release pnpm package:app
```

The command uploads a temporary zip, waits for `Accepted`, staples and validates the
ticket, then creates the release zip. Rejection or tool failure stops the build. The script
does not import certificates or create credentials; signing may still prompt for Keychain
access. A distributable build needs Safari 18.4 or later. The default release workflow does
not enable this path.

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

Regenerating also resets `MACOSX_DEPLOYMENT_TARGET` to whatever macOS the generator ran on,
which silently narrows the supported range. Set it back to 13.3 to match Safari 16.4.

## Building the app

`pnpm build:app` runs `scripts/build-app.ts`, which builds `dist/safari`, then drives
`xcodebuild` into `dist/xcode` and copies the result to `dist/vimplug.app`. Extension
resources land at `vimplug.app/Contents/PlugIns/vimplug Extension.appex/Contents/Resources/`.

Three things in there are load-bearing.

`MARKETING_VERSION` is passed on the command line from `package.json`, because the project
file holds a `1.0` placeholder that would otherwise ship as the app's version.

The ad-hoc and Apple Development builds rely on generated entitlements. Do not add
`CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO` to those paths: it drops the sandbox entitlement,
and Safari refuses the extension. Developer ID builds instead supply complete
`Distribution.entitlements` files for both targets before disabling base injection.

Both build products are unregistered from LaunchServices at the end. `xcodebuild` registers
whatever it builds, so without that step every build adds another vimplug to Safari's
extension list, identical in name, version and icon to the installed one and offering the
same Uninstall button. Only `/Applications/vimplug.app` should ever be registered. To see
what is:

```sh
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -dump | grep -E 'path:.*vimplug.*\.app'
```

## Loading for development

Recent Safari loads an unpacked extension directly, with no host app involved. Prefer this
while developing; the app is for installing.

1. Safari > Settings > Advanced > check "Show features for web developers".
2. Safari > Settings > Developer > check "Allow unsigned extensions". This resets whenever
   Safari restarts.
3. Safari > Settings > Developer > "Add Temporary Extension…", then pick the `dist/safari`
   directory itself, not a file inside it.
4. Safari > Settings > Extensions > enable vimplug and set site access to "Always Allow on
   Every Website". Without site access `registerContentScripts` silently injects nothing,
   which looks identical to a broken build.

To test the packaged form instead, follow "Installing" above. Enable only one at a time: a
temporary extension and an installed app are separate extensions to Safari, and the
`window.__vimplugLoaded` guard is per-extension, so both enabled means every key twice.

Background console: Safari > Develop > Web Extension Background Content > vimplug.

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
nothing. Every call is guarded, so the absent APIs produce empty results instead of errors.
`X` falls back to a stack of our own in `storage.session`: the last 25 tabs closed since
Safari started, reopened at their URL and position but without their back history.

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
| 6 | Permissions Safari withholds | Press `o` and type part of an open tab's title; then press `b`; then close a tab with `x` and press `X` | The tab is offered and Enter switches to it. `b` finds nothing and does not throw. `X` reopens the closed tab where it was — Safari grants no `history`, `bookmarks` or `sessions`. |
| 7 | Storage survives a restart | Scroll down, press `Ma`, quit and reopen Safari, press `` `a `` | The position is restored |
| 8 | The installed app registers the extension | Install the release zip as README describes, open the app once | vimplug appears under Settings > Extensions without any temporary extension loaded. This is the path README sends people down, and only an ad-hoc signed bundle in Safari can confirm it. |

Find highlighting depends on the CSS Custom Highlight API, which Safari has from 17.2. On
anything older the panel still opens and still scrolls to matches, and only the painting
is skipped; `pnpm test:engine` covers that fallback.
