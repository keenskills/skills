// Synthesises the showreel's soundtrack to showreel.wav: 128 BPM, 32 beats, with
// every hit on the beat showreel.html animates on. Usage: node audio.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 48000, B = 0.46875, LEN = SR * 15, TAU = Math.PI * 2
const L = new Float32Array(LEN)
let seed = 1
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 31 - 1
// One voice: fn(seconds since its start), from beat `at`, for `dur` seconds.
const voice = (at, dur, fn) => { const s = Math.round(at * B * SR), n = Math.round(dur * SR); for (let i = 0; i < n && s + i < LEN; i++) L[s + i] += fn(i / SR) }
const svf = (type) => { let lo = 0, bd = 0; return (x, fc, q = 0.7) => { const f = 2 * Math.sin((Math.PI * Math.min(fc, 7000)) / SR); lo += f * bd; const hi = x - lo - bd / q; bd += f * hi; return type === 'lp' ? lo : type === 'hp' ? hi : bd } }

const kick = (at, g = 1) => { let ph = 0; voice(at, 0.4, (t) => { ph += (TAU * (46 + 120 * Math.exp(-t * 30))) / SR; return g * 0.9 * (Math.sin(ph) * Math.exp(-t * 8) + (t < 0.004 ? rnd() * 0.3 : 0)) }) }
const hat = (at, g = 0.1) => { const f = svf('hp'); voice(at, 0.08, (t) => f(rnd(), 6000) * Math.exp(-t * 70) * g) }
const clap = (at, g = 0.22) => { const f = svf('bp'); voice(at, 0.25, (t) => f(rnd(), 1400, 1.2) * g * (t < 0.033 ? Math.exp(-(t % 0.011) * 300) : 0.8 * Math.exp(-(t - 0.033) * 28))) }
const bass = (at, f0, g = 0.22, len = 0.2) => { const f = svf('lp'); let ph = 0; voice(at, len + 0.05, (t) => { ph += f0 / SR; return f(2 * (ph % 1) - 1, 300 + 1400 * Math.exp(-t * 18), 1.5) * g * Math.min(1, t * 400) * cl((len + 0.05 - t) * 40) }) }
const cl = (x) => Math.min(1, Math.max(0, x))
// A sine blip; chirp > 0 starts sharp and falls onto the note.
const blip = (at, f0, g = 0.14, decay = 22, chirp = 0.4) => { let ph = 0; voice(at, 0.5, (t) => { ph += (TAU * f0 * (1 + chirp * Math.exp(-t * 60))) / SR; return Math.sin(ph) * Math.exp(-t * decay) * g * Math.min(1, t * 2000) }) }
const click = (at, g = 0.08) => { const f = svf('hp'); voice(at, 0.02, (t) => f(rnd(), 4000) * Math.exp(-t * 500) * g) }
const whoosh = (at, beats, g = 0.2, f0 = 300, f1 = 5000) => { const f = svf('bp'), d = beats * B; voice(at, d, (t) => { const x = t / d; return f(rnd(), f0 * (f1 / f0) ** x, 2) * Math.sin(Math.PI * x ** 1.5) ** 2 * g }) }
const impact = (at, g = 0.5) => { let ph = 0; const f = svf('lp'); voice(at, 1.2, (t) => { ph += (TAU * (40 + 60 * Math.exp(-t * 20))) / SR; return g * (Math.sin(ph) * Math.exp(-t * 4) + f(rnd(), 80 + 900 * Math.exp(-t * 6)) * Math.exp(-t * 9) * 0.8) * cl((1.2 - t) * 20) }) }
const shing = (at, g = 0.05) => voice(at, 0.6, (t) => [3100, 4730, 6270, 7910].reduce((s, f, i) => s + Math.sin(TAU * f * t + i), 0) * Math.exp(-t * 9) * g)
const stab = (at, freqs, g = 0.05, dur = 1.4) => { const f = svf('lp'); voice(at, dur, (t) => { let s = 0; for (const fr of freqs) for (const d of [-0.004, 0.004]) s += 2 * ((fr * (1 + d) * t) % 1) - 1; return f(s, 500 + 3500 * Math.exp(-t * 5), 1) * g * Math.min(1, t * 300) * Math.exp((-3 * t) / dur) * cl((dur - t) * 20) }) }

const F = [87.31, 174.61, 220, 261.63], G = [98, 196, 246.94, 293.66], A = [110, 220, 277.18, 329.63] // bass, then the triad

// A. hook: spark, SHARPER, the cut, the split, the iris
blip(0, 1760, 0.12, 10, 0); blip(0, 2640, 0.05, 12, 0)
impact(1, 0.45); stab(1, [110, 164.81, 220], 0.06, 1)
shing(2); click(2, 0.15)
impact(3, 0.4); whoosh(3, 0.8, 0.14, 400, 3000)
kick(4, 0.8); hat(4.5); kick(5, 0.8); whoosh(5.2, 0.8, 0.22, 300, 6000)

// B, C, D: the groove steps up F, G, A, one chord per skill
for (let b = 6; b < 24; b++) {
  const n = (b < 12 ? F : b < 18 ? G : A)[0]
  kick(b); hat(b + 0.5, 0.11); hat(b + 0.25, 0.04); hat(b + 0.75, 0.04); bass(b + 0.5, n)
  if (b % 2) clap(b)
  if (b % 4 === 3) bass(b + 0.75, n * 2, 0.14, 0.1)
}
;[[6, F, 0.4], [12, G, 0.3], [18, A, 0.3]].forEach(([b, ch, g]) => { impact(b, g); stab(b, ch.slice(1)) })
whoosh(11.2, 0.8); whoosh(17.3, 0.7); whoosh(23.2, 0.8)
// B: rows land as the scan passes, then the three problems
;[8.19, 8.29, 8.5, 8.6, 9.3].forEach((b) => click(b))
;[523.25, 587.33, 698.46].forEach((f, i) => blip(9.5 + i * 0.5, f)); blip(11, 349.23, 0.16); click(11)
// C: nodes, arrowheads, the lint snap, the page, the formats
;[392, 493.88, 587.33, 783.99, 987.77].forEach((f, i) => blip(12.25 + i * 0.25, f))
;[13.7, 14.2, 14.45, 14.7, 14.95].forEach((b) => click(b, 0.06))
blip(15.1, 587.33, 0.08); blip(15.75, 1174.66); click(15.75, 0.12); blip(15.95, 1567.98, 0.07); impact(16, 0.2)
;[587.33, 783.99, 987.77].forEach((f, i) => blip(16.5 + i * 0.25, f))
// D: lines written, flagged, fixed, stamped
for (let i = 0; i < 7; i++) click(18.9 + i * 0.18, 0.06)
for (let i = 0; i < 3; i++) { blip(20.5 + i * 0.25, 233.08, 0.16, 16, 0.6); blip(21.5 + i * 0.25, [880, 1108.73, 1318.51][i]) }
impact(22.5, 0.3); click(22.5, 0.15)

// E. outro: the drums drop out, the colours collide on 25, the name rides a lighter groove
whoosh(24.1, 0.9, 0.25, 200, 7000)
impact(25, 0.55); stab(25, [220, 277.18, 329.63, 440], 0.07, 2.2); bass(25, 110, 0.2, 0.4)
for (let i = 0; i < 11; i++) click(25.7 + i * 0.045, 0.04)
for (let b = 26; b <= 30; b++) { kick(b, 0.7); if (b < 30) { hat(b + 0.5, 0.09); bass(b + 0.5, 110, 0.18) } if (b % 2) clap(b, 0.16) }
blip(26.5, 659.25, 0.06); blip(27.5, 440, 0.1)
for (let b = 27.6; b < 28.4; b += 0.08) click(b, 0.03)
blip(28.75, 554.37, 0.1); blip(29.75, 659.25, 0.1)
stab(30.5, [440, 554.37, 659.25, 880], 0.05, 2); blip(30.5, 1760, 0.1, 6, 0)

// master: soft clip, short fade out, 16-bit stereo
const pcm = Buffer.alloc(44 + LEN * 4)
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + LEN * 4, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22)
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(LEN * 4, 40)
for (let i = 0; i < LEN; i++) { const v = Math.round(Math.tanh(L[i] * 1.1) * cl((LEN - i) / (SR * 0.25)) * 0.9 * 32767); pcm.writeInt16LE(v, 44 + i * 4); pcm.writeInt16LE(v, 46 + i * 4) }
const file = join(dirname(fileURLToPath(import.meta.url)), 'showreel.wav')
writeFileSync(file, pcm)
console.log(`wrote ${file}`)
