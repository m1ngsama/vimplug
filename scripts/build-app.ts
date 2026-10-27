import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { notarize, signingConfig, verifyApp } from './signing.ts'

const LSREGISTER =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
const signing = signingConfig(process.env)
const built = 'dist/xcode/Build/Products/Release/vimplug.app'
const output = 'dist/vimplug.app'

rmSync(output, { force: true, recursive: true })
rmSync('dist/vimplug-safari.zip', { force: true })
try {
  execFileSync(
    'xcodebuild',
    [
      '-project', 'xcode/vimplug/vimplug.xcodeproj',
      '-scheme', 'vimplug',
      '-configuration', 'Release',
      '-destination', 'generic/platform=macOS',
      '-derivedDataPath', 'dist/xcode',
      '-quiet',
      ...signing.settings,
      `MARKETING_VERSION=${version}`,
      'build',
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  )
  verifyApp(built, Boolean(signing.developerId))
  if (signing.profile) notarize(built, signing.profile)
  execFileSync('ditto', [built, output])
  verifyApp(output, Boolean(signing.developerId))
  console.info(`vimplug.app ${version} at ${output}${signing.profile ? ' (notarized)' : ''}`)
} catch (error) {
  rmSync(output, { force: true, recursive: true })
  throw error
} finally {
  // Xcode registers its build product; remove temporary copies from Safari's extension list.
  for (const app of [built, output]) {
    try {
      execFileSync(LSREGISTER, ['-u', resolve(app)], { stdio: 'ignore' })
    } catch {}
  }
}
