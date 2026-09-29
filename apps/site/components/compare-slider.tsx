'use client'
type Img = { src: string; width: number; height: number; alt: string }

// Two renders stacked; the top one is clipped with clip-path: inset(), so the
// comparison needs no extra DOM and stays on the compositor. Step buttons move
// it with a short ease-in-out (.cmp-glide in motion.css, off with reduced
// motion); dragging follows the pointer with no easing. The two names sit under
// the picture, so they never cover the diagram; each dims when its side is gone.
export function CompareSlider({ before, after, value, onChange, animate }: { before: Img; after: Img; value: number; onChange: (v: number) => void; animate: boolean }) {
  const glide = animate ? 'cmp-glide' : ''
  return (
    <div className="card overflow-hidden">
      <div className="relative select-none overflow-hidden bg-white has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-accent">
        <img src={after.src} width={after.width} height={after.height} alt={after.alt} className="block h-auto w-full" />
        <img
          src={before.src}
          width={before.width}
          height={before.height}
          alt={before.alt}
          className={`absolute inset-0 block h-auto w-full ${glide}`}
          style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Compare the draft and the final diagram"
          aria-valuetext={`${value}% draft`}
          className="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
        />
        <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${glide}`} style={{ transform: `translateX(${value}%)` }}>
          <div className="absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-neutral-900/50" />
          <div className="absolute left-0 top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-neutral-600 shadow-[0_1px_4px_rgb(0_0_0/0.25)]">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 4 2 8l4 4M10 4l4 4-4 4" />
            </svg>
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs font-medium">
        <span style={{ opacity: value > 8 ? 1 : 0.4 }} className="cmp-chip text-warn">Draft</span>
        <span className="font-normal text-muted">Drag to compare</span>
        <span style={{ opacity: value < 92 ? 1 : 0.4 }} className="cmp-chip text-ok">Final</span>
      </div>
    </div>
  )
}
