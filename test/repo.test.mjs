import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const root = new URL('../', import.meta.url)
const json = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'))

describe('marketplace', () => {
  const m = json('.claude-plugin/marketplace.json')

  it('is the keenskills marketplace', () => {
    assert.equal(m.name, 'keenskills')
    assert.equal(m.owner.name, 'keenskills')
  })

  // Each listed plugin must install on its own, since the skills stay separate products.
  for (const p of m.plugins) {
    describe(p.name, () => {
      const dir = `${p.source.replace(/^\.\//, '')}/`

      it('has a plugin.json with the same name', () => {
        assert.equal(json(`${dir}.claude-plugin/plugin.json`).name, p.name)
      })

      it('has the same plugin and npm version', () => {
        assert.equal(json(`${dir}.claude-plugin/plugin.json`).version, json(`${dir}package.json`).version)
      })

      it('ships its skill where Claude Code looks for it', () => {
        assert.ok(existsSync(new URL(`${dir}skills/${p.name}/SKILL.md`, root)))
      })
    })
  }
})

describe('page-as-data package', () => {
  const pkg = json('packages/page-as-data/package.json')

  it('is published under the shared scope from this repo', () => {
    assert.equal(pkg.name, '@keenskills/page-as-data')
    assert.deepEqual(pkg.repository, { type: 'git', url: 'git+https://github.com/keenskills/skills.git', directory: 'packages/page-as-data' })
  })

  // A CRLF shebang makes npx fail with "env: node\r".
  it('keeps LF line endings in the CLI', () => {
    assert.ok(!readFileSync(new URL('packages/page-as-data/cli.mjs', root), 'utf8').includes('\r'))
  })

  it('no longer carries its own marketplace', () => {
    assert.ok(!existsSync(new URL('packages/page-as-data/.claude-plugin/marketplace.json', root)))
  })
})

describe('release docs', () => {
  // git push --follow-tags only sends annotated tags, and npm version no longer
  // tags inside the monorepo, so a plain `git tag` release never reaches CI.
  for (const doc of ['CLAUDE.md', 'packages/page-as-data/CLAUDE.md', 'packages/page-as-data/README.md']) {
    it(`${doc} tags releases with an annotated package tag`, () => {
      const text = readFileSync(new URL(doc, root), 'utf8')
      assert.match(text, /git tag -a page-as-data@v|git tag -a <package>@v/)
      assert.doesNotMatch(text, /git tag (?!-a)/)
    })
  }
})

describe('publish workflow', () => {
  // Old habits push tags like v0.2.0; the workflow must start and let
  // scripts/release-target.mjs reject them with a message, not stay silent.
  it('runs on every tag so release-target.mjs can reject a wrong one', () => {
    const yml = readFileSync(new URL('.github/workflows/publish.yml', root), 'utf8')
    assert.match(yml, /tags: \['\*\*'\]/)
  })
})

describe('skills', () => {
  // The skills stay separate products: one plugin each, never a bundle.
  it('lists each skill as its own plugin', () => {
    const m = json('.claude-plugin/marketplace.json')
    assert.deepEqual(m.plugins.map((p) => [p.name, p.source]), [
      ['page-as-data', './packages/page-as-data'],
      ['drawing-architecture-diagrams', './packages/drawing-architecture-diagrams'],
    ])
  })

  it('tests every package in CI', () => {
    const yml = readFileSync(new URL('.github/workflows/test.yml', root), 'utf8')
    for (const name of ['page-as-data', 'drawing-architecture-diagrams']) {
      assert.match(yml, new RegExp(`working-directory: packages/${name}\\n`), name)
    }
    assert.match(yml, /drawing-architecture-diagrams:[\s\S]*setup-node[\s\S]*setup-python[\s\S]*run: npm test/)
  })
})
