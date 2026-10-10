function parsed(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function parentOnce(url: string): string | null {
  const u = parsed(url)
  if (!u) return null

  if (u.search !== '' || u.hash !== '') {
    u.search = ''
    u.hash = ''
    return u.href.replace(/\/$/, u.pathname === '/' ? '/' : '')
  }

  const segments = u.pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  segments.pop()
  u.pathname = segments.length === 0 ? '/' : `/${segments.join('/')}`
  return u.href.replace(/\/$/, u.pathname === '/' ? '/' : '')
}

export function parentUrl(url: string, levels = 1): string | null {
  let at: string | null = null
  for (let i = 0; i < levels; i += 1) {
    const next = parentOnce(at ?? url)
    if (next === null) break
    at = next
  }
  return at
}

export function rootUrl(url: string): string | null {
  const u = parsed(url)
  if (!u) return null
  if (u.pathname === '/' && u.search === '' && u.hash === '') return null
  return `${u.origin}/`
}

export function runUrl(action: string, count = 1): boolean {
  const next = action === 'urlUp' ? parentUrl(location.href, count) : action === 'urlRoot' ? rootUrl(location.href) : undefined
  if (next === undefined) return false
  if (next) location.href = next
  return true
}
