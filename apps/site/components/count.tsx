'use client'
import { useEffect, useRef } from 'react'

// transitions.dev "Number pop-in", played once when the number scrolls into view.
// Digits are visible without the class, so no script means a plain number.
export function Count({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const text = value.toLocaleString('en-US')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      el.classList.remove('is-animating')
      void el.offsetWidth
      el.classList.add('is-animating')
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const digits = [...text]
  return (
    <span ref={ref} className="t-digit-group tabular-nums" aria-label={text}>
      {digits.map((ch, i) => (
        <span key={i} className="t-digit" aria-hidden="true" data-stagger={i >= digits.length - 2 ? String(i - digits.length + 3) : undefined}>
          {ch}
        </span>
      ))}
    </span>
  )
}
