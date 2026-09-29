'use client'
import { useLayoutEffect, useRef } from 'react'

// transitions.dev "Success check". Mounted only when the moment happens; the
// reduced-motion guard in the snippet shows it static.
export function SuccessCheck() {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const path = el?.querySelector('path')
    if (!el || !path) return
    // Dash length from the real path, rounded up by 1 (the snippet's 20 is a placeholder).
    const len = String(Math.ceil(path.getTotalLength()) + 1)
    path.style.strokeDasharray = len
    path.style.strokeDashoffset = len
    void el.offsetWidth
    el.setAttribute('data-state', 'in')
  }, [])
  return (
    <span
      ref={ref}
      className="t-success-check grid size-5 place-items-center rounded-full bg-ok-soft text-ok"
      data-state="out"
      aria-hidden="true"
      // A 20 px badge: a smaller bob and turn than the snippet's defaults for a large icon.
      style={{ ['--check-y-amount' as string]: '8px', ['--check-rotate-from' as string]: '45deg' }}
    >
      <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 10.5 3.2 3L15 6.5" />
      </svg>
    </span>
  )
}
