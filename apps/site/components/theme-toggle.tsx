'use client'
import { useEffect, useState } from 'react'
import { THEME_KEY, nextTheme } from '@/lib/theme-script.mjs'

type Theme = 'light' | 'dark'
const current = (): Theme =>
  (document.documentElement.dataset.theme as Theme | undefined) ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null)
  useEffect(() => setTheme(current()), [])
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'

  function toggle() {
    const next = nextTheme(current())
    const apply = () => {
      document.documentElement.dataset.theme = next
      setTheme(next)
    }
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {}
    // One crossfade of the whole page instead of every surface snapping on its own.
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduce && 'startViewTransition' in document) document.startViewTransition(apply)
    else apply()
  }

  return (
    <span className="t-tt-wrap">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className="t-tt-trigger press grid size-8 place-items-center rounded-full bg-chip text-text hover:bg-chip-hover"
      >
        <span className="t-icon-swap" data-state={theme === 'dark' ? 'b' : 'a'} data-ready={theme ? '' : undefined}>
          <svg className="t-icon size-4" data-icon="a" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
          </svg>
          <svg className="t-icon size-4" data-icon="b" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
            <path d="M13.5 9.6A5.5 5.5 0 0 1 6.4 2.5a5.5 5.5 0 1 0 7.1 7.1Z" />
          </svg>
        </span>
      </button>
      <span className="t-tt t-tt--end" role="tooltip">
        {label}
      </span>
    </span>
  )
}
