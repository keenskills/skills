export const PMS = [
  { id: 'npm', label: 'npm', run: 'npx' },
  { id: 'pnpm', label: 'pnpm', run: 'pnpm dlx' },
  { id: 'bun', label: 'bun', run: 'bunx' },
]
export const PM_KEY = 'pm'
// Every switcher on the page listens, so picking pnpm once changes every command.
export const PM_EVENT = 'pm-change'

export function commandFor(pm, pkg, args = '') {
  const p = PMS.find((x) => x.id === pm) ?? PMS[0]
  return `${p.run} ${pkg}${args ? ` ${args}` : ''}`
}
