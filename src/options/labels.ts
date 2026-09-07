import { OPTION_SCHEMA } from '../shared/config.ts'

export const LABELS: Record<string, { label: string; help: string }> = {
  hintChars: { label: 'Hint characters', help: 'Letters used to label hints, in order.' },
  keyMatching: {
    label: 'Key matching',
    help: 'Physical matches the key position, so bindings hold under an IME or a non-QWERTY layout.',
  },
  scrollStep: { label: 'Scroll step', help: 'Pixels moved by one scroll key.' },
  scrollSmooth: { label: 'Smooth scrolling', help: 'Animate scrolling instead of jumping.' },
  sequenceTimeout: {
    label: 'Sequence timeout',
    help: 'Milliseconds to wait for the rest of a multi-key binding.',
  },
  volumeStep: { label: 'Volume step', help: 'How much one volume key changes playback, 0 to 1.' },
  searchEngine: { label: 'Search engine', help: 'URL template for searches; %s is the query.' },
}

export const labelFor = (key: string) => LABELS[key] ?? { label: key, help: '' }

export const MISSING_LABELS = OPTION_SCHEMA.filter(o => !LABELS[o.key as string]).map(o => o.key)
