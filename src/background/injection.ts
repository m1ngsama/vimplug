import type { Target } from '../shared/manifest-def.ts'

interface Registration {
  id: string
  js: string[]
  matches: string[]
  excludeMatches?: string[]
  allFrames: boolean
  runAt: 'document_start'
  persistAcrossSessions: boolean
}

export const REGISTRATION_ID = 'vimplug'

function matchPatterns(pattern: string): string[] {
  if (pattern.startsWith('*.')) return [`*://${pattern}/*`]
  return [`*://${pattern}/*`, `*://*.${pattern}/*`]
}

export function registrationFor(target: Target, disabled: string[]): Registration {
  const base: Registration = {
    id: REGISTRATION_ID,
    // Safari ignores excludeMatches (FB16590857), so it keeps a fail-closed bootstrap: don't unify.
    js: [target === 'safari' ? 'bootstrap.js' : 'content.js'],
    matches: ['<all_urls>'],
    allFrames: true,
    runAt: 'document_start',
    persistAcrossSessions: false,
  }

  if (target === 'safari' || disabled.length === 0) return base

  return { ...base, excludeMatches: disabled.flatMap(matchPatterns) }
}

export function isDisabled(disabled: string[], host: string): boolean {
  return disabled.some(p => (p.startsWith('*.') ? host.endsWith(p.slice(1)) : p === host))
}

export function hostOf(url: string | undefined): string {
  if (!url) return ''
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? hostname : ''
  } catch {
    return ''
  }
}
