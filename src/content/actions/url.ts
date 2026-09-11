function parsed(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export function parentUrl(url: string): string | null {
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

export function rootUrl(url: string): string | null {
  const u = parsed(url)
  if (!u) return null
  if (u.pathname === '/' && u.search === '' && u.hash === '') return null
  return `${u.origin}/`
}

export function runUrl(action: string): boolean {
  const next = action === 'urlUp' ? parentUrl(location.href) : action === 'urlRoot' ? rootUrl(location.href) : undefined
  if (next === undefined) return false
  if (next) location.href = next
  return true
}
