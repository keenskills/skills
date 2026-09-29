'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

// transitions.dev "Menu dropdown" for the skill links the phone header has no room for.
// It opens from the trigger's top-left, so it cannot run off the right edge at 390 px.
export function SkillsMenu({ skills }: { skills: { slug: string; title: string }[] }) {
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const el = menu.current
    if (!el) return
    if (open) {
      el.classList.remove('is-closing')
      el.classList.add('is-open')
      return
    }
    if (!el.classList.contains('is-open')) return
    const closeMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dropdown-close-dur')) || 150
    el.classList.remove('is-open')
    el.classList.add('is-closing')
    const t = setTimeout(() => el.classList.remove('is-closing'), closeMs)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="skills-menu"
        onClick={() => setOpen((o) => !o)}
        className="press inline-flex min-h-6 items-center gap-1 hover:text-text"
      >
        Skills
        <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      <div ref={menu} id="skills-menu" className="t-dropdown card absolute left-0 top-full z-40 mt-2 w-52 p-1.5" data-origin="top-left" style={{ boxShadow: 'var(--card-shadow), 0 12px 32px -8px oklch(0 0 0 / 0.25)' }}>
        <ul>
          {skills.map((s) => (
            <li key={s.slug}>
              <Link href={`/${s.slug}`} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-text hover:bg-chip">
                {s.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
