import type { Target } from '../shared/manifest-def.ts'

export interface Registration {
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
    // Safari ignores excludeMatches (FB16590857), so it gets a bootstrap that confirms
    // the site is enabled before importing the engine. Do not unify these two branches.
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

// The toolbar button acts on the page's host, and only where the engine can run at all.
export function hostOf(url: string | undefined): string {
  if (!url) return ''
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? hostname : ''
  } catch {
    return ''
  }
}
