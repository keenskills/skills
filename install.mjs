/**
 * page-as-data init / uninstall — teach coding agents to read a screen with
 * page-as-data instead of a screenshot. One skill body (skill/page-as-data.md),
 * written in each agent's own format. Zero dependencies.
 *
 * Planning only reads the disk; applyPlan() is the one place that writes, so a
 * --dry-run is the very plan that would run.
 */
import { readFileSync } from 'node:fs'

export const BODY = readFileSync(new URL('./skill/page-as-data.md', import.meta.url), 'utf8').trim()
export const DESCRIPTION =
  'Read a web page as data instead of a screenshot: what is on screen, what broke behind it (exceptions, failed requests), and layout defects at phone and desktop widths. Use when checking, debugging or verifying web UI work.'
export const MANAGED = 'page-as-data:managed'
export const START = '<!-- page-as-data:start -->'
export const END = '<!-- page-as-data:end -->'
const NOTE = `<!-- ${MANAGED}: generated from skill/page-as-data.md in @rajaaltus/page-as-data. Edits here are replaced on update. -->`
// JSON strings are valid YAML double-quoted scalars; the description has a colon in it.
const DESCRIPTION_YAML = JSON.stringify(DESCRIPTION)

/** A file page-as-data owns whole: frontmatter first (agents parse it only there), then the marker. */
export const owned = (frontmatter) => `${frontmatter ? `---\n${frontmatter}\n---\n` : ''}${NOTE}\n\n${BODY}\n`
/** The part page-as-data owns inside a file the user also writes in. */
export const block = () => `${START}\n${BODY}\n${END}`
export const renderSkill = () => owned(`name: page-as-data\ndescription: ${DESCRIPTION_YAML}`)
export const renderCursor = () => owned(`description: ${DESCRIPTION_YAML}\nalwaysApply: false`)
export const renderWindsurf = () => owned(`trigger: model_decision\ndescription: ${DESCRIPTION_YAML}`)
export const renderCopilot = () => owned('applyTo: "**"')
export const renderPlain = () => owned()

// Where the marked block is. A merge can leave half of it behind: then say so
// rather than guess, because guessing either duplicates it or cuts user text.
function findBlock(text) {
  const s = text.indexOf(START)
  const e = s === -1 ? text.indexOf(END) : text.indexOf(END, s)
  if (s === -1 && e === -1) return null
  if (s === -1 || e === -1) return 'broken'
  return { s, e: e + END.length }
}

/** Puts `blk` in place of the old block, or after the text. Every byte outside the markers stays. */
export function upsertBlock(text, blk) {
  const at = findBlock(text)
  if (at === 'broken') return null
  if (at) return text.slice(0, at.s) + blk + text.slice(at.e)
  if (!text) return `${blk}\n`
  return `${text}${text.endsWith('\n') ? '\n' : '\n\n'}${blk}\n`
}

/** Takes the block out again, with the blank line upsertBlock put before it. */
export function stripBlock(text) {
  const at = findBlock(text)
  if (at === 'broken') return null
  if (!at) return text
  const before = text.slice(0, at.s).replace(/(\r?\n){0,2}$/, '')
  const after = text.slice(at.e).replace(/^\r?\n/, '')
  return before && after ? `${before}\n\n${after}` : before ? `${before}\n` : after
}
