// Maps a release tag to the package it publishes, so one publish workflow
// serves every package. A wrong tag must stop the job before npm publish.
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const TAG = /^(?<name>[a-z0-9][a-z0-9-]*)@v(?<version>\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/

export function releaseTarget(tag, root = new URL('../', import.meta.url)) {
  const m = TAG.exec(tag)
  if (!m) throw new Error(`"${tag}" is not a release tag: expected a tag like page-as-data@v1.2.3`)
  const { name, version } = m.groups
  const dir = `packages/${name}`
  const file = new URL(`${dir}/package.json`, root)
  if (!existsSync(file)) throw new Error(`no package at ${dir} for tag ${tag}`)
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  if (pkg.version !== version) throw new Error(`tag says ${version} but ${dir}/package.json says ${pkg.version}`)
  return { name, dir, version }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const t = releaseTarget(process.argv[2] ?? '')
    console.log(`name=${t.name}\ndir=${t.dir}\nversion=${t.version}`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
