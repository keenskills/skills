import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'
import { releaseTarget } from '../scripts/release-target.mjs'

function fakeRepo(version) {
  const dir = mkdtempSync(join(tmpdir(), 'release-'))
  mkdirSync(join(dir, 'packages/page-as-data'), { recursive: true })
  writeFileSync(join(dir, 'packages/page-as-data/package.json'), JSON.stringify({ name: '@keenskills/page-as-data', version }))
  return pathToFileURL(`${dir}/`)
}

describe('releaseTarget', () => {
  it('maps a package tag to its folder and version', () => {
    assert.deepEqual(releaseTarget('page-as-data@v0.2.0', fakeRepo('0.2.0')), { name: 'page-as-data', dir: 'packages/page-as-data', version: '0.2.0' })
  })

  it('accepts a prerelease', () => {
    assert.equal(releaseTarget('page-as-data@v0.3.0-beta.1', fakeRepo('0.3.0-beta.1')).version, '0.3.0-beta.1')
  })

  for (const tag of ['v0.2.0', 'page-as-data@0.2.0', 'page-as-data@v0.2', '@v0.2.0']) {
    it(`rejects the malformed tag ${tag}`, () => {
      assert.throws(() => releaseTarget(tag, fakeRepo('0.2.0')), /expected a tag like page-as-data@v1\.2\.3/)
    })
  }

  it('rejects a package that does not exist', () => {
    assert.throws(() => releaseTarget('pageasdata@v0.2.0', fakeRepo('0.2.0')), /no package at packages\/pageasdata/)
  })

  it('rejects a tag that does not match package.json', () => {
    assert.throws(() => releaseTarget('page-as-data@v0.2.0', fakeRepo('0.1.1')), /tag says 0\.2\.0 but packages\/page-as-data\/package\.json says 0\.1\.1/)
  })

  it('fails the workflow step with exit code 1', () => {
    const script = new URL('../scripts/release-target.mjs', import.meta.url).pathname
    assert.throws(() => execFileSync('node', [script, 'v0.2.0'], { stdio: 'pipe' }), (e) => e.status === 1)
  })
})
