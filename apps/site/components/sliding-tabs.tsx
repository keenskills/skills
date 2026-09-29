'use client'
import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react'

export type TabOption = { id: string; label: string }

// transitions.dev "Tabs sliding". The pill glides on a pointer click; arrow keys
// move it instantly (keyboard actions are never animated).
export function SlidingTabs({
  label,
  options,
  value,
  onChange,
  idPrefix,
  panelId,
  size = 'md',
}: {
  label: string
  options: TabOption[]
  value: string
  onChange: (id: string) => void
  idPrefix?: string
  panelId?: (id: string) => string
  size?: 'sm' | 'md'
}) {
  const bar = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const animate = useRef(false)

  const place = (smooth: boolean) => {
    const tab = bar.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
    const p = pill.current
    if (!tab || !p) return
    if (!smooth) p.style.transition = 'none'
    p.style.transform = `translateX(${tab.offsetLeft}px)`
    p.style.width = `${tab.offsetWidth}px`
    if (!smooth) {
      void p.offsetWidth
      p.style.transition = ''
    }
  }
  useLayoutEffect(() => {
    place(animate.current)
    animate.current = false
  }, [value])
  useLayoutEffect(() => {
    const onResize = () => place(false)
    window.addEventListener('resize', onResize)
    // Webfonts change tab widths after first paint.
    document.fonts?.ready.then(() => place(false))
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const pick = (id: string, e: MouseEvent | KeyboardEvent) => {
    animate.current = e.type === 'click' && (e as MouseEvent).detail > 0
    onChange(id)
  }
  const onKey = (e: KeyboardEvent) => {
    const i = options.findIndex((o) => o.id === value)
    const next = e.key === 'ArrowRight' ? (i + 1) % options.length : e.key === 'ArrowLeft' ? (i - 1 + options.length) % options.length : -1
    if (next < 0) return
    e.preventDefault()
    pick(options[next].id, e)
    bar.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div ref={bar} className={`t-tabs max-w-full overflow-x-auto ${size === 'sm' ? 'text-xs' : 'text-sm'}`} role="tablist" aria-label={label} onKeyDown={onKey}>
      <span ref={pill} className="t-tabs-pill shadow-[var(--card-shadow)]" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          id={idPrefix ? `${idPrefix}-tab-${o.id}` : undefined}
          aria-controls={panelId?.(o.id)}
          aria-selected={o.id === value}
          tabIndex={o.id === value ? 0 : -1}
          className="t-tab shrink-0 font-medium"
          onClick={(e) => pick(o.id, e)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
