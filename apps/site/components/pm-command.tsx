'use client'
import { useEffect, useState } from 'react'
import { PMS, PM_EVENT, PM_KEY, commandFor, type Pm } from '@/lib/commands.mjs'
import { CopyButton } from './copy-button'
import { SlidingTabs } from './sliding-tabs'
import { useTextSwap } from './use-text-swap'

// A command well with an npm / pnpm / bun switcher. Every instance on the page
// follows one stored choice, so picking pnpm once rewrites them all.
export function PmCommand({ pkg, args = '', label, name = 'install', switcher = true }: { pkg: string; args?: string; label?: string; name?: string; switcher?: boolean }) {
  const [pm, setPm] = useState<Pm>('npm')
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PM_KEY)
      if (saved && PMS.some((p) => p.id === saved)) setPm(saved as Pm)
    } catch {}
    const follow = (e: Event) => setPm((e as CustomEvent<Pm>).detail)
    window.addEventListener(PM_EVENT, follow)
    return () => window.removeEventListener(PM_EVENT, follow)
  }, [])
  const choose = (id: string) => {
    try {
      localStorage.setItem(PM_KEY, id)
    } catch {}
    window.dispatchEvent(new CustomEvent(PM_EVENT, { detail: id }))
  }
  const command = commandFor(pm, pkg, args)
  const [shown, ref] = useTextSwap(command)

  return (
    <figure className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {label ? <figcaption className="text-xs text-muted">{label}</figcaption> : <span />}
        {switcher ? <SlidingTabs label="Package manager" size="sm" options={PMS} value={pm} onChange={choose} /> : null}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-code py-1.5 pl-3 pr-1.5">
        <pre tabIndex={0} className="min-w-0 flex-1 overflow-x-auto font-mono text-[13px] leading-6">
          <code ref={ref} className="t-text-swap" data-command={name}>
            {shown}
          </code>
        </pre>
        <CopyButton text={command} ariaLabel={`Copy ${label ?? 'command'}`} />
      </div>
    </figure>
  )
}
