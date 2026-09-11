export type TokenName =
  | 'bg'
  | 'fg'
  | 'muted'
  | 'border'
  | 'accent'
  | 'accentFg'
  | 'match'
  | 'matchCurrent'
  | 'ground'
  | 'scrim'

export type Tokens = Record<TokenName, string>

export const TOKEN_VARS: Record<TokenName, string> = {
  bg: '--vp-bg',
  fg: '--vp-fg',
  muted: '--vp-muted',
  border: '--vp-border',
  accent: '--vp-accent',
  accentFg: '--vp-accent-fg',
  match: '--vp-match',
  matchCurrent: '--vp-match-cur',
  ground: '--vp-ground',
  scrim: '--vp-scrim',
}

export const SCHEMES: Record<string, Tokens> = {
  'default-dark': {
    bg: '#21201c', fg: '#f5f4f1', muted: '#a39f96', border: '#3a3833',
    accent: '#ffd76e', accentFg: '#21201c',
    match: '#ffe08a', matchCurrent: '#ff9f45',
    ground: '#191b1f', scrim: 'rgba(0,0,0,.28)',
  },
  'default-light': {
    bg: '#fdfdfc', fg: '#1c1e22', muted: '#71757d', border: '#d0d4da',
    accent: '#ffd76e', accentFg: '#21201c',
    match: '#ffe08a', matchCurrent: '#ff9f45',
    ground: '#e9ebef', scrim: 'rgba(0,0,0,.28)',
  },
  'gruvbox-dark': {
    bg: '#282828', fg: '#ebdbb2', muted: '#928374', border: '#504945',
    accent: '#fabd2f', accentFg: '#282828',
    match: '#b8bb26', matchCurrent: '#fe8019',
    ground: '#1d2021', scrim: 'rgba(0,0,0,.35)',
  },
  'gruvbox-light': {
    bg: '#fbf1c7', fg: '#3c3836', muted: '#7c6f64', border: '#d5c4a1',
    accent: '#d79921', accentFg: '#282828',
    match: '#98971a', matchCurrent: '#d65d0e',
    ground: '#f2e5bc', scrim: 'rgba(60,56,54,.25)',
  },
  nord: {
    bg: '#2e3440', fg: '#eceff4', muted: '#7b88a1', border: '#434c5e',
    accent: '#88c0d0', accentFg: '#2e3440',
    match: '#a3be8c', matchCurrent: '#ebcb8b',
    ground: '#272c36', scrim: 'rgba(0,0,0,.35)',
  },
  'catppuccin-mocha': {
    bg: '#1e1e2e', fg: '#cdd6f4', muted: '#9399b2', border: '#45475a',
    accent: '#f9e2af', accentFg: '#1e1e2e',
    match: '#a6e3a1', matchCurrent: '#fab387',
    ground: '#181825', scrim: 'rgba(0,0,0,.35)',
  },
  'catppuccin-latte': {
    bg: '#eff1f5', fg: '#4c4f69', muted: '#8c8fa1', border: '#ccd0da',
    accent: '#df8e1d', accentFg: '#1e1e2e',
    match: '#40a02b', matchCurrent: '#fe640b',
    ground: '#e6e9ef', scrim: 'rgba(76,79,105,.22)',
  },
  'tokyo-night': {
    bg: '#1a1b26', fg: '#c0caf5', muted: '#565f89', border: '#292e42',
    accent: '#e0af68', accentFg: '#1a1b26',
    match: '#9ece6a', matchCurrent: '#ff9e64',
    ground: '#16161e', scrim: 'rgba(0,0,0,.4)',
  },
  'solarized-dark': {
    bg: '#002b36', fg: '#93a1a1', muted: '#586e75', border: '#073642',
    accent: '#b58900', accentFg: '#002b36',
    match: '#859900', matchCurrent: '#cb4b16',
    ground: '#001f27', scrim: 'rgba(0,0,0,.35)',
  },
  'solarized-light': {
    bg: '#fdf6e3', fg: '#586e75', muted: '#93a1a1', border: '#eee8d5',
    accent: '#b58900', accentFg: '#002b36',
    match: '#859900', matchCurrent: '#cb4b16',
    ground: '#eee8d5', scrim: 'rgba(88,110,117,.2)',
  },
}

export const SCHEME_NAMES: string[] = ['system', ...Object.keys(SCHEMES)]

export interface ThemeOptions {
  theme: string
  themeBg: string
  themeFg: string
  themeMuted: string
  themeBorder: string
  themeAccent: string
  themeAccentFg: string
  themeMatch: string
  themeMatchCurrent: string
  themeGround: string
  themeScrim: string
}

const OVERRIDE_OF: Record<TokenName, keyof ThemeOptions> = {
  bg: 'themeBg',
  fg: 'themeFg',
  muted: 'themeMuted',
  border: 'themeBorder',
  accent: 'themeAccent',
  accentFg: 'themeAccentFg',
  match: 'themeMatch',
  matchCurrent: 'themeMatchCurrent',
  ground: 'themeGround',
  scrim: 'themeScrim',
}

export function resolveTheme(o: ThemeOptions, prefersDark: boolean): Tokens {
  const fallback = prefersDark ? 'default-dark' : 'default-light'
  const base = SCHEMES[o.theme === 'system' ? fallback : o.theme] ?? SCHEMES[fallback]!

  const out = { ...base }
  for (const [token, key] of Object.entries(OVERRIDE_OF) as [TokenName, keyof ThemeOptions][]) {
    const value = o[key]
    if (value !== '') out[token] = value
  }
  return out
}

export function applyTheme(el: HTMLElement, t: Tokens): void {
  for (const [token, cssVar] of Object.entries(TOKEN_VARS) as [TokenName, string][]) {
    el.style.setProperty(cssVar, t[token])
  }
}
