import type { CSSProperties } from 'react'

/** When a scene piece starts (ms), plus any of its animation's variables: dur in ms, tx and ty in px, grow as a scale. */
export const d = (ms: number, vars: { dur?: number; tx?: number; ty?: number; grow?: number } = {}) =>
  ({
    ['--d' as string]: `${ms}ms`,
    ...(vars.dur === undefined ? {} : { ['--dur' as string]: `${vars.dur}ms` }),
    ...(vars.tx === undefined ? {} : { ['--tx' as string]: `${vars.tx}px` }),
    ...(vars.ty === undefined ? {} : { ['--ty' as string]: `${vars.ty}px` }),
    ...(vars.grow === undefined ? {} : { ['--grow' as string]: vars.grow.toFixed(3) }),
  }) as CSSProperties

/** Milliseconds per typed character. */
export const TYPE = 8

/** A command typed a character at a time, starting at `at`. Plain text without script. */
export function Typed({ text, at }: { text: string; at: number }) {
  return [...text].map((c, i) => (
    <span key={i} className="sc sc-char" style={d(at + i * TYPE)}>
      {c}
    </span>
  ))
}

export type Step = { text: string; at: number; end: number; live?: boolean }

/** One line of status under a scene's drawing, swapped in place; `final` arrives at `at` and stays. */
export function SceneStatus({ steps, final, at }: { steps: Step[]; final: string; at: number }) {
  return (
    <p className="absolute bottom-3.5 left-4 right-24 grid font-mono text-xs text-muted sm:left-6">
      {steps.map((s) => (
        <span key={s.text} aria-hidden="true" className="sc sc-enter col-start-1 row-start-1" style={d(s.at)}>
          <span className="sc sc-leave block" style={d(s.end)}>
            {s.live ? (
              <span className="t-shimmer" data-text={s.text}>
                {s.text}
              </span>
            ) : (
              s.text
            )}
          </span>
        </span>
      ))}
      <span className="sc sc-enter col-start-1 row-start-1" style={d(at)}>
        {final}
      </span>
    </p>
  )
}
