'use client'
import { useEffect, useRef } from 'react'

// The night behind the hero and the closing band, drawn as light. Far off, faint
// pages hang in columns at different depths, each a heading and paragraphs of
// lines; a slow reading light passes down them and lights the lines it reads
// (the scan page-as-data runs). Below, a townscape seen from a hill: far ridges
// pricked with lights, a city of lit windows under its own glow, a valley road
// with lamps and passing cars, and a tree line in front. Colours come from the
// tokens (--sky-*). The still parts are painted once per size into two layers;
// only lights that change are drawn each frame. Paused off screen; reduced
// motion draws one still frame; no script leaves the CSS night.
type Line = { x: number; y: number; w: number; h: number }
type Page = { x: number; y: number; w: number; depth: number; lines: Line[] }
type Blink = { x: number; y: number; size: number; p: number; tone: 'lit' | 'cool' | 'red'; period: number }
type Car = { at: number; speed: number; dir: 1 | -1 }

const SWEEP = 14000 // ms for the reading light to cross the sky once
const FADE_IN = 1200 // ms for the night to arrive

function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

// One page: a heading, then paragraphs whose last line runs short.
function makePage(rand: () => number, x: number, y: number, w: number, depth: number): Page {
  const lead = 7 + depth * 3
  const lines: Line[] = [{ x: 0, y: 0, w: w * (0.35 + rand() * 0.25), h: 2.2 }]
  let at = lead * 2
  for (let p = 0, n = 2 + Math.floor(rand() * 3); p < n; p++) {
    const rows = 3 + Math.floor(rand() * 4)
    for (let r = 0; r < rows; r++) {
      const last = r === rows - 1
      lines.push({ x: 0, y: at, w: w * (last ? 0.3 + rand() * 0.35 : 0.82 + rand() * 0.18), h: 1.2 })
      at += lead
    }
    at += lead * 0.9
  }
  return { x, y, w, depth, lines }
}

function grainTile(rand: () => number) {
  const c = document.createElement('canvas')
  c.width = c.height = 160
  const g = c.getContext('2d')
  if (!g) return ''
  const img = g.createImageData(160, 160)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.round(rand() * 255)
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return `url(${c.toDataURL('image/png')})`
}

export function NightSky({ seed = 7, horizon = 0.84 }: { seed?: number; horizon?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let pages: Page[] = []
    let w = 0
    let h = 0
    let raf = 0
    let visible = true
    let started = -1
    const tone = { ink: '', lit: '', land: '', hill: '', far: '', town: '', mid: '', cool: '', red: '' }

    const night = canvas.closest<HTMLElement>('.night')
    if (night && !night.style.getPropertyValue('--grain')) night.style.setProperty('--grain', grainTile(seeded(seed * 31)))

    // The still town: everything behind the cars, and the tree line in front.
    const back = document.createElement('canvas')
    const front = document.createElement('canvas')
    const glows: Record<Blink['tone'], HTMLCanvasElement | null> = { lit: null, cool: null, red: null }
    let blinks: Blink[] = []
    let cars: Car[] = []
    let s = 1

    const ridge = (x: number, base: number, amp: number, k: number) =>
      base - amp * (0.55 * Math.sin(x / (w * 0.21) + k) + 0.3 * Math.sin(x / (w * 0.083) + k * 2.3) + 0.15 * Math.sin(x / (w * 0.031) + k * 5.1))
    const road = (x: number) => h * horizon + 25 * s + 4 * s * Math.sin(x / (w * 0.17) + 0.8) + 2 * s * Math.sin(x / (w * 0.061) + 2.1)

    // A soft round light, one per colour, stamped wherever a light glows.
    const sprite = (colour: string) => {
      const c = document.createElement('canvas')
      c.width = c.height = 32
      const g = c.getContext('2d')
      if (!g) return null
      const r = g.createRadialGradient(16, 16, 0, 16, 16, 16)
      r.addColorStop(0, colour)
      r.addColorStop(0.25, colour)
      r.addColorStop(1, 'transparent')
      g.globalAlpha = 1
      g.fillStyle = r
      g.fillRect(0, 0, 32, 32)
      return c
    }
    const dot = (g: CanvasRenderingContext2D, x: number, y: number, size: number, colour: string, a: number, glow = 0, sp: HTMLCanvasElement | null = null) => {
      if (glow && sp) {
        g.globalAlpha = a * 0.35
        g.drawImage(sp, x - glow, y - glow, glow * 2, glow * 2)
      }
      g.globalAlpha = a
      g.fillStyle = colour
      g.fillRect(x - size / 2, y - size / 2, size, size)
    }

    const paintTown = (rand: () => number, dpr: number) => {
      for (const c of [back, front]) {
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
      }
      const g = back.getContext('2d')
      const f = front.getContext('2d')
      if (!g || !f) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      f.setTransform(dpr, 0, 0, dpr, 0, 0)
      const sky = h * horizon
      const fill = (ctx2: CanvasRenderingContext2D, colour: string, top: (x: number) => number, step = 4) => {
        ctx2.globalAlpha = 1
        ctx2.fillStyle = colour
        ctx2.beginPath()
        ctx2.moveTo(0, h)
        for (let x = 0; x <= w + step; x += step) ctx2.lineTo(x, top(x))
        ctx2.lineTo(w, h)
        ctx2.closePath()
        ctx2.fill()
      }
      blinks = []

      // Cities: one large, two small, each with a glow on the haze above it.
      const cities = [
        { c: 0.42 + rand() * 0.08, r: 0.11, tall: 74 },
        { c: 0.08 + rand() * 0.1, r: 0.05, tall: 30 },
        { c: 0.8 + rand() * 0.1, r: 0.06, tall: 38 },
      ]
      for (const city of cities) {
        const cx = city.c * w
        const rad = city.r * w * 2.4
        const dome = g.createRadialGradient(cx, sky + 4, 0, cx, sky + 4, rad)
        dome.addColorStop(0, tone.lit)
        dome.addColorStop(1, 'transparent')
        g.globalAlpha = 0.05 + city.tall / 1400
        g.fillStyle = dome
        g.fillRect(cx - rad, sky - rad, rad * 2, rad + 8)
      }

      // The far ridge, and the scattered lights of farms and villages on it.
      const far = (x: number) => ridge(x, sky - 4 * s, 12 * s, 3.3)
      fill(g, tone.far, far)
      for (let i = 0, n = Math.round(w / 9); i < n; i++) {
        const x = rand() * w
        if (Math.sin(x / (w * 0.05) + 1.3) < -0.2) continue
        const y = far(x) + 2 + rand() * (sky - far(x) + 4 * s)
        dot(g, x, y, 1, rand() > 0.8 ? tone.cool : tone.lit, 0.18 + rand() * 0.3)
      }

      // Buildings in two rows: the back row smaller and hazier.
      const row = (depth: 0 | 1) => {
        for (const city of cities) {
          const cx = city.c * w
          const spread = city.r * w
          for (let x = cx - spread * 2.2; x < cx + spread * 2.2; ) {
            const bw = (depth ? 6 + rand() * 13 : 4 + rand() * 9) * s
            const fall = Math.exp(-(((x + bw / 2 - cx) / spread) ** 2))
            if (fall < 0.06 || rand() > 0.35 + fall) {
              x += bw + rand() * 6 * s
              continue
            }
            const tall = (depth ? 1 : 0.7) * (5 + city.tall * fall * (0.35 + rand() * 0.75)) * s
            const base = sky + (depth ? 9 : 5) * s
            const top = base - tall
            g.globalAlpha = 1
            g.fillStyle = depth ? tone.hill : tone.far
            g.fillRect(x, top, bw, tall)
            // A setback on the taller ones, sometimes a mast with a warning light.
            let roof = top
            if (tall > 30 * s && rand() > 0.45) {
              const inset = bw * (0.15 + rand() * 0.2)
              const step = (4 + rand() * 8) * s
              g.fillRect(x + inset, top - step, bw - inset * 2, step)
              roof = top - step
            }
            if (tall > 38 * s && rand() > 0.5) {
              const mast = (5 + rand() * 10) * s
              g.fillRect(x + bw / 2 - 0.5, roof - mast, 1, mast)
              blinks.push({ x: x + bw / 2, y: roof - mast, size: 1.6, p: rand() * 2000, tone: 'red', period: 1800 + rand() * 900 })
            }
            // Windows on a grid: some floors fully lit, most scattered.
            const cw = (depth ? 3.2 : 2.6) * s
            const ch = (depth ? 3.8 : 3.2) * s
            const cols = Math.floor((bw - 2 * s) / cw)
            const floors = Math.floor((tall - 3 * s) / ch)
            const density = (depth ? 0.16 : 0.1) + fall * 0.22
            for (let fl = 0; fl < floors; fl++) {
              const office = rand() > 0.93
              for (let col = 0; col < cols; col++) {
                if (!office && rand() > density) continue
                const wx = x + 1.5 * s + col * cw + cw / 2
                const wy = base - 2 * s - fl * ch - ch / 2
                const cool = rand() > 0.78
                if (depth && rand() > 0.985) {
                  blinks.push({ x: wx, y: wy, size: 1.3 * s, p: rand() * 20000, tone: cool ? 'cool' : 'lit', period: 9000 + rand() * 14000 })
                  continue
                }
                dot(g, wx, wy, (depth ? 1.4 : 1.1) * s, cool ? tone.cool : tone.lit, (depth ? 0.45 : 0.28) + rand() * 0.4)
              }
            }
            x += bw + (rand() > 0.7 ? rand() * 5 * s : 0.5)
          }
        }
      }
      row(0)
      // Air between the rows: the back row sinks into the haze.
      const haze = g.createLinearGradient(0, sky - 70 * s, 0, sky + 6 * s)
      haze.addColorStop(0, 'transparent')
      haze.addColorStop(1, tone.mid)
      g.globalAlpha = 0.45
      g.fillStyle = haze
      g.fillRect(0, sky - 70 * s, w, 76 * s)
      row(1)

      // The valley floor, its houses, and the road with its lamps.
      const valley = (x: number) => ridge(x, sky + 11 * s, 4 * s, 2.9)
      fill(g, tone.town, valley)
      for (let i = 0, n = Math.round(w / 14); i < n; i++) {
        const x = rand() * w
        const y = valley(x) + 3 * s + rand() * 18 * s
        if (Math.abs(y - road(x)) < 2.5 * s) continue
        dot(g, x, y, 1.2 * s, rand() > 0.75 ? tone.cool : tone.lit, 0.3 + rand() * 0.45, rand() > 0.7 ? 5 * s : 0, glows.lit)
      }
      g.globalAlpha = 0.07
      g.strokeStyle = tone.lit
      g.lineWidth = 3 * s
      g.beginPath()
      for (let x = 0; x <= w + 6; x += 6) (x ? g.lineTo(x, road(x)) : g.moveTo(x, road(x)))
      g.stroke()
      // Lamps stand in runs near the towns and thin out between them.
      for (let x = rand() * 18 * s; x < w; x += (12 + rand() * 22) * s) {
        if (Math.sin(x / (w * 0.07) + 0.4) < -0.35 && rand() > 0.25) continue
        dot(g, x, road(x) - 2.2 * s, 1.2 * s, tone.lit, 0.3 + rand() * 0.35, 5 * s, glows.lit)
      }
      // Light from the towns spills onto the valley floor.
      for (const city of cities) {
        const cx = city.c * w
        const rad = city.r * w * 1.6
        const spill = g.createRadialGradient(cx, sky + 10 * s, 0, cx, sky + 10 * s, rad)
        spill.addColorStop(0, tone.lit)
        spill.addColorStop(1, 'transparent')
        g.globalAlpha = 0.035 + city.tall / 2400
        g.fillStyle = spill
        g.fillRect(cx - rad, sky, rad * 2, rad)
      }

      // The near hill and its tree line, a few farmhouses lit on it.
      const hill = (x: number) => ridge(x, sky + 46 * s, 9 * s, 4.4)
      fill(f, tone.land, hill)
      f.fillStyle = tone.land
      for (let x = -10; x < w + 10; ) {
        const wood = Math.sin(x / (w * 0.045) + 0.6) + Math.sin(x / (w * 0.13) + 2) * 0.6
        if (wood < 0) {
          x += 6
          continue
        }
        const tall = (5 + rand() * 9 + wood * 5) * s
        const wide = (3 + rand() * 5) * s
        const y = hill(x) + 2
        f.beginPath()
        if (rand() > 0.5) {
          f.moveTo(x - wide / 2, y)
          f.lineTo(x, y - tall)
          f.lineTo(x + wide / 2, y)
        } else {
          f.ellipse(x, y - tall * 0.55, wide * 0.65, tall * 0.55, 0, 0, Math.PI * 2)
        }
        f.fill()
        x += wide * (0.45 + rand() * 0.5)
      }
      // A lane winds down the near hill toward the viewer, a lamp now and then,
      // and a few farms sit in clusters on the slope.
      const lane = rand() * 0.3 + 0.6
      for (let y = hill(lane * w) + 4 * s, i = 0; y < h - 4; y += (9 + rand() * 10) * s, i++) {
        const d = (y - sky) / (h - sky)
        const x = lane * w + Math.sin(d * 5 + 1.2) * 60 * s * d - d * d * 120 * s
        dot(f, x, y, (1.2 + d * 1.6) * s, tone.lit, 0.35 + d * 0.3, (4 + d * 8) * s, glows.lit)
      }
      for (let i = 0, n = Math.max(2, Math.round(w / 420)); i < n; i++) {
        const cx = (i + 0.2 + rand() * 0.6) * (w / n)
        const cy = hill(cx) + (12 + rand() * 40) * s
        for (let j = 0, m = 1 + Math.floor(rand() * 4); j < m; j++) {
          const x = cx + (rand() - 0.5) * 26 * s
          const y = cy + (rand() - 0.5) * 8 * s
          if (y > h - 6 || y < hill(x) + 4) continue
          const d = (y - sky) / (h - sky)
          dot(f, x, y, (1.4 + d * 1.4) * s, rand() > 0.8 ? tone.cool : tone.lit, 0.45 + rand() * 0.35, rand() > 0.5 ? (5 + d * 8) * s : 0, glows.lit)
        }
      }
      f.globalAlpha = 1
      g.globalAlpha = 1

      cars = []
      for (let i = 0, n = Math.max(3, Math.round(w / 160)); i < n; i++) cars.push({ at: rand(), speed: (14 + rand() * 18) * s, dir: rand() > 0.5 ? 1 : -1 })
    }

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      s = Math.min(1, Math.max(0.62, w / 1200))
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const css = getComputedStyle(canvas)
      const read = (name: string) => css.getPropertyValue(name).trim()
      tone.ink = read('--sky-ink')
      tone.lit = read('--sky-lit')
      tone.land = read('--sky-land')
      tone.hill = read('--sky-hill')
      tone.far = read('--sky-far')
      tone.town = read('--sky-town')
      tone.mid = read('--sky-mid')
      tone.cool = read('--sky-cool')
      tone.red = read('--sky-red')
      glows.lit = sprite(tone.lit)
      glows.cool = sprite(tone.cool)
      glows.red = sprite(tone.red)
      const rand = seeded(seed)
      // Columns of pages across the width, deeper ones smaller and fainter.
      pages = []
      const sky = h * horizon
      for (let x = -40; x < w; ) {
        const depth = rand()
        const pw = 90 + depth * 110
        pages.push(makePage(rand, x + rand() * 30, 70 + rand() * sky * 0.45, pw, depth))
        if (rand() > 0.45) pages.push(makePage(rand, x + rand() * 40, sky * 0.42 + rand() * sky * 0.3, pw * 0.85, depth * 0.6))
        x += pw + 50 + rand() * 120
      }
      paintTown(rand, dpr)
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      const sky = h * horizon
      const arrive = still ? 1 : started < 0 ? 0 : Math.min(1, (t - started) / FADE_IN)
      const band = still ? sky * 0.46 : ((t % SWEEP) / SWEEP) * (sky + 220) - 110
      const drift = still ? 0 : t / 1000

      // The reading light itself: a soft band, barely there.
      const g = ctx.createLinearGradient(0, band - 90, 0, band + 90)
      g.addColorStop(0, 'transparent')
      g.addColorStop(0.5, tone.lit)
      g.addColorStop(1, 'transparent')
      ctx.globalAlpha = 0.045 * arrive
      ctx.fillStyle = g
      ctx.fillRect(0, band - 90, w, 180)

      for (const pg of pages) {
        const px = pg.x + drift * (0.6 + pg.depth * 2.4)
        const x0 = ((px + pg.w + 80) % (w + pg.w + 160)) - pg.w - 80
        const base = 0.07 + pg.depth * 0.11
        for (const l of pg.lines) {
          const y = pg.y + l.y
          if (y > sky - 14) break
          // Quiet under the nav, fading again toward the horizon haze.
          const top = Math.min(1, Math.max(0, (y - 40) / 110))
          const low = Math.min(1, Math.max(0, (sky - 14 - y) / 90))
          const near = Math.max(0, 1 - Math.abs(y - band) / 60)
          ctx.globalAlpha = (base + near * 0.42) * top * low * arrive
          ctx.fillStyle = near > 0.2 ? tone.lit : tone.ink
          ctx.fillRect(x0 + l.x, y, l.w, l.h)
        }
      }

      ctx.globalAlpha = arrive
      ctx.drawImage(back, 0, 0, w, h)

      // Mast lights pulse; a few windows go on and off over the minutes.
      for (const b of blinks) {
        const phase = ((still ? 0 : t) + b.p) % b.period
        const a = b.tone === 'red' ? (still ? 0.8 : Math.max(0, Math.sin((phase / b.period) * Math.PI * 2)) ** 2) : phase < b.period * 0.6 ? 0.7 : 0
        if (a < 0.02) continue
        dot(ctx, b.x, b.y, b.size, tone[b.tone], a * arrive, b.tone === 'red' ? 5 * s : 0, glows[b.tone])
      }

      // Cars on the valley road: headlights one way, tail lights the other.
      for (const car of cars) {
        const run = w + 40
        const x = ((((car.at * run + car.dir * car.speed * (still ? 0 : t / 1000)) % run) + run) % run) - 20
        const y = road(x) + car.dir * 0.9 * s
        if (car.dir > 0) {
          dot(ctx, x, y, 1.6 * s, tone.cool, 0.85 * arrive, 5 * s, glows.cool)
        } else {
          dot(ctx, x, y, 1.3 * s, tone.red, 0.75 * arrive, 3.5 * s, glows.red)
        }
      }

      ctx.globalAlpha = arrive
      ctx.drawImage(front, 0, 0, w, h)
      ctx.globalAlpha = 1
    }

    const loop = (t: number) => {
      if (started < 0) started = t
      draw(t)
      if (visible && !still) raf = requestAnimationFrame(loop)
    }

    build()
    if (still) draw(0)
    const ro = new ResizeObserver(() => {
      build()
      draw(performance.now())
    })
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      cancelAnimationFrame(raf)
      if (visible && !still) raf = requestAnimationFrame(loop)
    })
    io.observe(canvas)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [seed, horizon])

  return <canvas ref={ref} className="night-sky" aria-hidden="true" />
}
