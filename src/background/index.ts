import { readDsl } from './storage.ts'

function messageType(m: unknown): string | null {
  if (typeof m !== 'object' || m === null) return null
  const t = (m as { type?: unknown }).type
  return typeof t === 'string' ? t : null
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (messageType(msg) !== 'getDsl') return false
  void readDsl().then(dsl => reply({ dsl }))
  return true
})
