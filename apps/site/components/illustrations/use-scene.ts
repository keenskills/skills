'use client'
import { useCallback, useEffect, useRef } from 'react'

// Scenes render their final frame. Script arms them (animations wait at frame 0)
// and plays them once when they scroll into view. Reduced motion never arms, so
// it keeps the final frame. ?t=1.2 freezes every scene at 1.2 s for screenshots.
export function useScene<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  const replay = useCallback(() => {
    const el = ref.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.removeAttribute('data-armed')
    el.removeAttribute('data-play')
    void el.offsetWidth
    el.setAttribute('data-armed', '')
    el.setAttribute('data-play', '')
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.setAttribute('data-armed', '')
    const t = new URLSearchParams(location.search).get('t')
    if (t !== null) {
      el.setAttribute('data-play', '')
      for (const a of el.getAnimations({ subtree: true })) {
        a.pause()
        a.currentTime = Number(t) * 1000
      }
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        el.setAttribute('data-play', '')
        io.disconnect()
      },
      { rootMargin: '0px 0px -15% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return { ref, replay }
}
