// init / uninstall: planning and writing against temp folders. No Chrome needed.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BODY, END, MANAGED, START, renderSkill, stripBlock, upsertBlock } from '../install.mjs'

describe('rendering', () => {
  it('renders the Claude Code skill with valid frontmatter first, then the managed note and the body', () => {
    const skill = renderSkill()
    assert.match(skill, /^---\nname: page-as-data\ndescription: "[^"\n]+"\n---\n/)
    assert.ok(skill.includes(MANAGED))
    assert.ok(skill.endsWith(`${BODY}\n`))
  })

  it('uses the scoped package name in every command', () => {
    assert.match(BODY, /npx @rajaaltus\/page-as-data read/)
    assert.doesNotMatch(BODY, /npx page-as-data/)
  })
})

const blk = `${START}\nnew\n${END}`

describe('marked block', () => {
  it('appends to a file without one, leaving the text before it untouched', () => {
    const text = '# Rules\n\nBe kind.\n'
    assert.equal(upsertBlock(text, blk), `${text}\n${blk}\n`)
  })

  it('makes the block the whole file when the file is empty', () => {
    assert.equal(upsertBlock('', blk), `${blk}\n`)
  })

  it('replaces only what is between the markers, keeping CRLF text around them', () => {
    const text = `before\r\n\r\n${START}\nold\n${END}\r\nafter\r\n`
    assert.equal(upsertBlock(text, blk), `before\r\n\r\n${blk}\r\nafter\r\n`)
  })

  it('refuses a start marker without its end marker, rather than adding a second block', () => {
    assert.equal(upsertBlock(`x\n${START}\nhalf`, blk), null)
    assert.equal(stripBlock(`x\n${START}\nhalf`), null)
    assert.equal(stripBlock(`x\n${END}\n${START}\n`), null)
  })

  it('strips the block back to the exact text it was added to', () => {
    const text = '# Rules\n\nBe kind.\n'
    assert.equal(stripBlock(upsertBlock(text, blk)), text)
  })

  it('leaves text without a block as it is', () => {
    assert.equal(stripBlock('plain\n'), 'plain\n')
  })
})
