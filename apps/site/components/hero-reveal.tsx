'use client'
import { useEffect, useRef } from 'react'

// transitions.dev "Texts reveal" for the hero. An effect (not an inline script)
// adds .is-shown, so it runs on a hard load and on client-side navigation back
// to /; <noscript> in the layout shows the text without script.
export function HeroReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const id = requestAnimationFrame(() => el.classList.add('is-shown'))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <div ref={ref} className="t-stagger" id="hero-copy">
      {children}
    </div>
  )
}
