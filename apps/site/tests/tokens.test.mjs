// WCAG contrast of the design tokens, in both themes, computed from globals.css.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const block = (selector) => css.slice(css.indexOf(`${selector} {`)).split('}')[0]
const tokens = (text) => Object.fromEntries([...text.matchAll(/--([a-z-]+):\s*oklch\(([^)]+)\)/g)].map(([, k, v]) => {
  const [lch, alpha] = v.split('/')
  const [L, C, H] = lch.trim().split(/\s+/).map(Number)
  return [k, { L, C, H, a: alpha ? Number(alpha) : 1 }]
}))

// OKLCH → gamma-encoded sRGB (browsers composite alpha in gamma space).
function srgb({ L, C, H }) {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  return lin.map((c) => Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)))
}
const over = (fg, bg) => srgb(fg).map((c, i) => c * fg.a + srgb(bg)[i] * (1 - fg.a))
const luminance = (rgb) => rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((y, c, i) => y + c * [0.2126, 0.7152, 0.0722][i], 0)
const contrast = (x, y) => {
  const [a, b] = [luminance(x), luminance(y)].sort((p, q) => q - p)
  return (a + 0.05) / (b + 0.05)
}

for (const [theme, t] of [['light', tokens(block(':root'))], ['dark', tokens(block(':root[data-theme="dark"]'))]]) {
  describe(`${theme} tokens`, () => {
    const on = (fg, bg) => contrast(over(t[fg], t[bg]), srgb(t[bg]))
    for (const [fg, bg] of [
      ['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'code'],
      ['accent', 'bg'], ['accent', 'surface'],
      ['danger', 'bg'], ['danger', 'code'], ['warn', 'bg'], ['warn', 'code'], ['ok', 'bg'], ['ok', 'code'],
    ]) {
      it(`${fg} on ${bg} is at least 4.5:1`, () => assert.ok(on(fg, bg) >= 4.5, on(fg, bg).toFixed(2)))
    }
    it('accent text on the accent-soft tint is at least 4.5:1', () => {
      const tint = over(t['accent-soft'], t.bg)
      const ratio = contrast(srgb(t.accent), tint)
      assert.ok(ratio >= 4.5, ratio.toFixed(2))
    })
    for (const s of ['danger', 'warn', 'ok']) {
      it(`${s} text on its own soft tint is at least 4.5:1`, () => {
        const ratio = contrast(srgb(t[s]), over(t[`${s}-soft`], t.surface))
        assert.ok(ratio >= 4.5, ratio.toFixed(2))
      })
    }
    it('the page and card surfaces match the reference palette', () => {
      const hex = (k) => srgb(t[k]).map((c) => Math.round(c * 255))
      const want = theme === 'light' ? { bg: [253, 253, 253], surface: [255, 255, 255] } : { bg: [15, 15, 15], surface: [24, 24, 24] }
      for (const [k, rgb] of Object.entries(want)) hex(k).forEach((c, i) => assert.ok(Math.abs(c - rgb[i]) <= 1, `${k} ${hex(k)}`))
    })
  })
}
