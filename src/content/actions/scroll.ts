import type { Options } from '../../shared/config.ts'

export function runScroll(action: string, o: Options): boolean {
  const d = o.scrollStep
  if (action === 'scrollDown') window.scrollBy({ top: d, behavior: 'instant' })
  else if (action === 'scrollUp') window.scrollBy({ top: -d, behavior: 'instant' })
  else if (action === 'scrollLeft') window.scrollBy({ left: -d, behavior: 'instant' })
  else if (action === 'scrollRight') window.scrollBy({ left: d, behavior: 'instant' })
  else return false
  return true
}
