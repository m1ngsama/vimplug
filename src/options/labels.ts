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

  theme: {
    label: 'Colour scheme',
    help: 'Light and dark are separate schemes: hints sit on other people\u2019s pages, so they follow your choice rather than your system.',
  },
  themeAccent: { label: 'Hint background', help: 'The colour a hint label is painted in.' },
  themeAccentFg: { label: 'Hint text', help: 'Text on the hint label.' },
  themeBg: { label: 'Panel background', help: 'Behind the search and command panels.' },
  themeFg: { label: 'Panel text', help: 'Primary text in those panels.' },
  themeMuted: { label: 'Secondary text', help: 'URLs and descriptions beside a result.' },
  themeBorder: { label: 'Borders', help: 'Edges and separators.' },
  themeMatch: { label: 'Find highlight', help: 'Every match of an in-page search.' },
  themeMatchCurrent: { label: 'Current match', help: 'The match you are on.' },
  themeGround: { label: 'Settings background', help: 'The page behind this one.' },
  themeScrim: { label: 'Panel shade', help: 'The wash over the page while a panel is open.' },
}

export const labelFor = (key: string) => LABELS[key] ?? { label: key, help: '' }

export const MISSING_LABELS = OPTION_SCHEMA.filter(o => !LABELS[o.key as string]).map(o => o.key)
