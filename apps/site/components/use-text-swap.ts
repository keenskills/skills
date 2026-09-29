'use client'
import { useEffect, useRef, useState } from 'react'

// transitions.dev "Text states swap" as a hook: the old text exits up with blur,
// React renders the new text, then it enters from below.
export function useTextSwap(value: string) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  const entering = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || value === shown) return
    const dur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-swap-dur')) || 150
    el.classList.add('is-exit')
    const t = setTimeout(() => {
      el.classList.remove('is-exit')
      el.classList.add('is-enter-start')
      entering.current = true
      setShown(value)
    }, dur)
    return () => clearTimeout(t)
  }, [value, shown])

  // After React has committed the new text: reflow, then let it transition to rest.
  useEffect(() => {
    const el = ref.current
    if (!el || !entering.current) return
    entering.current = false
    void el.offsetHeight
    el.classList.remove('is-enter-start')
  }, [shown])

  return [shown, ref] as const
}
