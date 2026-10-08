'use client'
import { useEffect, useRef, useState } from 'react'

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

/** Last week's npm downloads: the build's number first, then npm's current one,
 *  so a static page does not go stale between deploys. A failed fetch keeps the
 *  build's number. */
export function WeeklyDownloads({ name, value }: { name: string; value: number }) {
  const [n, setN] = useState(value)
  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`https://api.npmjs.org/downloads/point/last-week/${name}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Number.isFinite(d?.downloads)) setN(d.downloads)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [name])
  return <Count key={n} value={n} />
}
