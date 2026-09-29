import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { resolveFile, routesFrom } from '../scripts/self-check.mjs'

function fakeExport() {
  const out = mkdtempSync(join(tmpdir(), 'out-'))
  for (const f of ['index.html', 'how-to-use.html', 'page-as-data.html', 'page-as-data/install.html', '404.html', '_not-found.html', '_next/static/x.html', 'favicon.ico']) {
    mkdirSync(join(out, f, '..'), { recursive: true })
    writeFileSync(join(out, f), f)
  }
  return out
}

describe('routesFrom', () => {
  it('lists every exported page, and not the 404 or build files', () => {
    assert.deepEqual(routesFrom(fakeExport()), ['/', '/how-to-use', '/page-as-data', '/page-as-data/install'])
  })
})

describe('resolveFile', () => {
  const out = fakeExport()

  it('serves pages the way a static host does', () => {
    assert.equal(resolveFile(out, '/'), join(out, 'index.html'))
    assert.equal(resolveFile(out, '/page-as-data'), join(out, 'page-as-data.html'))
    assert.equal(resolveFile(out, '/page-as-data/install?x=1'), join(out, 'page-as-data', 'install.html'))
    assert.equal(resolveFile(out, '/favicon.ico'), join(out, 'favicon.ico'))
  })

  it('returns null for a missing page', () => {
    assert.equal(resolveFile(out, '/missing'), null)
  })

  it('never serves a file outside the export', () => {
    assert.equal(resolveFile(out, '/../package.json'), null)
    assert.equal(resolveFile(out, '/%2e%2e/package.json'), null)
  })
})
