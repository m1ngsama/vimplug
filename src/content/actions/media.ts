export function nextVolume(current: number, dir: 1 | -1, step: number): number {
  return Math.min(1, Math.max(0, current + dir * step))
}

function players(): HTMLMediaElement[] {
  return Array.from(document.querySelectorAll<HTMLMediaElement>('video, audio'))
}

export function runMedia(action: string, step: number): boolean {
  const all = players()
  if (action === 'volumeUp' || action === 'volumeDown') {
    const dir = action === 'volumeUp' ? 1 : -1
    for (const el of all) el.volume = nextVolume(el.volume, dir, step)
    return true
  }
  if (action === 'toggleMute') {
    const muting = all.some(el => !el.muted)
    for (const el of all) el.muted = muting
    return true
  }
  return false
}
