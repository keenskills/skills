'use client'
import { useRef, useState } from 'react'
import { copyText } from '@/lib/copy.mjs'
import { useTextSwap } from './use-text-swap'

const SAID = { copied: 'Copied', failed: 'Copy failed' } as const

const LOOK = {
  chip: 'h-8 gap-1.5 bg-chip px-3 text-xs text-text hover:bg-chip-hover',
  primary: 'h-9 gap-2 bg-text px-4 text-sm text-bg',
}

export function CopyButton({ text, label = 'Copy', ariaLabel, variant = 'chip' }: { text: string; label?: string; ariaLabel?: string; variant?: keyof typeof LOOK }) {
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
      className={`press inline-flex shrink-0 items-center rounded-full font-medium ${LOOK[variant]}`}
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
