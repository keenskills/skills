'use client'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { copyText } from '@/lib/copy.mjs'
import { PMS, PM_EVENT, PM_KEY, commandFor, type Pm } from '@/lib/commands.mjs'
import { SlidingTabs } from './sliding-tabs'
import { useTextSwap } from './use-text-swap'

export type Channel = { pkg: string; title: string; version: string }

const SAID = { copied: 'Copied', failed: 'Copy failed' } as const

/** When an intro piece starts, in ms after the panel is seen. */
const at = (ms: number) => ({ ['--d' as string]: `${ms}ms` }) as CSSProperties

// The panel loads once, when 30% of it is in view: the card rises out of blur,
// then its head, each skill's row (the switch pops), the commands and the copy
// pill. The HTML is the loaded panel. This script, inline right after it, arms
// the intro before the first paint and plays it, without waiting for React; if
// it never runs, or motion is reduced, nothing is ever hidden. The state lives on
// <html> (data-intro), like the theme, so React's own markup is never touched.
const INTRO = `(()=>{const e=document.getElementById('install'),h=document.documentElement;if(!e||matchMedia('(prefers-reduced-motion: reduce)').matches)return;h.dataset.intro='armed';const o=new IntersectionObserver(([x])=>{if(!x.isIntersecting)return;o.disconnect();requestAnimationFrame(()=>requestAnimationFrame(()=>{h.dataset.intro='in'}))},{threshold:0.3});o.observe(e)})()`

export function InstallPanel({ channels }: { channels: Channel[] }) {
  const [on, setOn] = useState<string[]>(channels.map((c) => c.pkg))
  const [pm, setPm] = useState<Pm>('npm')
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PM_KEY)
      if (saved && PMS.some((p) => p.id === saved)) setPm(saved as Pm)
    } catch {}
    const follow = (e: Event) => setPm((e as CustomEvent<Pm>).detail)
    window.addEventListener(PM_EVENT, follow)
    return () => {
      window.removeEventListener(PM_EVENT, follow)
      clearTimeout(timer.current)
    }
  }, [])

  const choose = (id: string) => {
    try {
      localStorage.setItem(PM_KEY, id)
    } catch {}
    window.dispatchEvent(new CustomEvent(PM_EVENT, { detail: id }))
  }
  const toggle = (pkg: string) => setOn((xs) => (xs.includes(pkg) ? xs.filter((x) => x !== pkg) : channels.map((c) => c.pkg).filter((x) => x === pkg || xs.includes(x))))
  const picked = channels.filter((c) => on.includes(c.pkg))
  const commands = picked.map((c) => commandFor(pm, 'skills', `add keenskills/skills --skill ${c.pkg}`))
  const label = commands.length > 1 ? `Copy ${commands.length} commands` : 'Copy command'
  const [shown, ref] = useTextSwap(state === 'idle' ? label : SAID[state])

  async function copy() {
    const ok = await copyText(commands.join('\n'))
    setState(ok ? 'copied' : 'failed')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1500)
  }

  return (
    <>
      <section className="instrument ix ix-card" style={at(250)} aria-labelledby="install-title" id="install">
        <div className="instrument-head ix ix-down" style={at(420)}>
          <h2 id="install-title" className="instrument-title">
            Install
          </h2>
          <SlidingTabs label="Package manager" size="sm" options={PMS} value={pm} onChange={choose} />
        </div>
        <ul className="bed">
          {channels.map((c, i) => {
            const lit = on.includes(c.pkg)
            return (
              <li key={c.pkg} className="channel ix ix-left" style={at(560 + i * 70)}>
                <button type="button" role="switch" aria-checked={lit} aria-label={`Install ${c.title}`} className="switch ix ix-pop" style={at(640 + i * 70)} onClick={() => toggle(c.pkg)}>
                  <span className="switch-knob" aria-hidden="true" />
                </button>
                <span className="channel-name">{c.title}</span>
                <span className="channel-version">v{c.version}</span>
              </li>
            )
          })}
        </ul>
        <div className="readout ix ix-up" style={at(820)} aria-live="polite">
          {commands.length ? (
            commands.map((c, i) => {
              // The line may wrap only before --skill, so a skill's name never splits.
              const flag = `--skill ${picked[i].pkg}`
              return (
                <pre key={c} tabIndex={0} className="readout-line">
                  <code data-command="install">
                    {c.slice(0, -flag.length)}
                    <span className="readout-flag">{flag}</span>
                  </code>
                </pre>
              )
            })
          ) : (
            <p className="readout-empty">Switch a skill on to see its command.</p>
          )}
        </div>
        <button type="button" className="metal-pill ix ix-pop" style={at(1000)} onClick={copy} disabled={!commands.length}>
          <span ref={ref} className="t-text-swap">
            {shown}
          </span>
        </button>
      </section>
      <script dangerouslySetInnerHTML={{ __html: INTRO }} />
    </>
  )
}
