import type { CSSProperties } from 'react'
import { Play } from 'reicon-react'
import { useTextSwap } from '../use-text-swap'

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

/** Runs the scene again from the start. While it runs, the icon folds away and the label swaps to Playing…. */
export function ScenePlay({ onClick, label, playing }: { onClick: () => void; label: string; playing: boolean }) {
  const [text, ref] = useTextSwap(playing ? 'Playing…' : 'Play')
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Play the ${label} illustration`}
      className="press absolute bottom-3 right-3 inline-flex items-center rounded-full bg-surface py-1 pl-2 pr-2.5 text-xs font-medium text-muted shadow-[var(--card-shadow)] hover:text-text"
    >
      <span className="scene-play-icon" data-hidden={playing ? '' : undefined}>
        <span>
          <Play size={11} weight="Filled" aria-hidden="true" />
        </span>
      </span>
      <span ref={ref} className="t-text-swap">
        {text}
      </span>
    </button>
  )
}
