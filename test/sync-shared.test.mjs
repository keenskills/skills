import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { TARGETS, vendored } from '../scripts/sync-shared.mjs'

const root = new URL('../', import.meta.url)

// Packages cannot import from each other or from shared/ at runtime (each is
// published alone), so each carries a copy; a stale copy would ship old code.
describe('vendored shared code', () => {
  for (const t of TARGETS) {
    it(`${t} carries the current shared installer (run pnpm sync after editing shared/)`, () => {
      assert.equal(readFileSync(new URL(`${t}/lib/skill-installer.mjs`, root), 'utf8'), vendored())
    })
  }
})
