'use client'
import { useRef, useState } from 'react'
import { copyText } from '@/lib/copy.mjs'
import { useTextSwap } from './use-text-swap'

const SAID = { copied: 'Copied', failed: 'Copy failed' } as const

export function CopyButton({ text, label = 'Copy', ariaLabel, className = '' }: { text: string; label?: string; ariaLabel?: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [shown, ref] = useTextSwap(state === 'idle' ? label : SAID[state])
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  async function onClick() {
    const ok = await copyText(text)
    setState(ok ? 'copied' : 'failed')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1500)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className={`press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-chip px-3 text-xs font-medium text-text hover:bg-chip-hover ${className}`}
    >
      <span className="t-icon-swap" data-state={state === 'copied' ? 'b' : 'a'} data-ready="">
        <svg className="t-icon size-3.5" data-icon="a" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="5" y="5" width="8.5" height="8.5" rx="2" />
          <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
        </svg>
        <svg className="t-icon size-3.5" data-icon="b" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      </span>
      <span ref={ref} className="t-text-swap" aria-hidden="true">
        {shown}
      </span>
      <span className="sr-only" aria-live="polite">
        {state === 'idle' ? '' : SAID[state]}
      </span>
    </button>
  )
}
