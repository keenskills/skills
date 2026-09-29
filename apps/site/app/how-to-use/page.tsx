import type { Metadata } from 'next'
import { CodeCommand } from '@/components/code-command'
import { PmCommand } from '@/components/pm-command'
import { agents, skills } from '@/lib/content'

export const metadata: Metadata = { title: 'How to use', description: 'Install a Keen Skills skill for your coding agent with one command, or as a Claude Code plugin.' }

export default function HowToUse() {
  return (
    <div className="py-12">
      <h1 className="text-3xl font-semibold tracking-tight">How to use</h1>
      <p className="mt-3 max-w-2xl text-muted text-pretty">
        Each skill is its own npm package. Run init in your project: it finds the agents you use and installs the skill in each one’s format. Nothing else changes.
      </p>

      {skills.map((s) => (
        <section key={s.slug} aria-labelledby={`${s.slug}-install`} className="mt-12">
          <h2 id={`${s.slug}-install`} className="text-xl font-semibold tracking-tight">
            {s.title}
          </h2>
          <div className="mt-4 grid gap-4">
            <PmCommand pkg={s.name} args="init" label="This project, for the agents it uses" name="install" />
            <PmCommand pkg={s.name} args="init --global" label="Claude Code, in every project" name="global" switcher={false} />
            <PmCommand pkg={s.name} args="init --agent claude,cursor" label="Pick the agents yourself" name="agents" switcher={false} />
            <PmCommand pkg={s.name} args="init --dry-run" label="See the plan first, write nothing" name="dry-run" switcher={false} />
            <PmCommand pkg={s.name} args="uninstall" label="Remove what init wrote" name="uninstall" switcher={false} />
            <CodeCommand label="As a Claude Code plugin" command={`/plugin marketplace add keenskills/skills\n/plugin install ${s.pkg}@keenskills`} />
          </div>
        </section>
      ))}

      <section aria-labelledby="agents-title" className="mt-12">
        <h2 id="agents-title" className="text-xl font-semibold tracking-tight">
          Where init writes
        </h2>
        <p className="mt-2 text-sm text-muted">
          &lt;skill&gt; is the package name. Shared files get a marked block; everything outside the markers stays yours.
        </p>
        <div className="table-scroll mt-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-code text-left">
                <th className="px-3 py-2 font-semibold">Agent</th>
                <th className="px-3 py-2 font-semibold">File</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-3 py-2">{a.label}</td>
                  <td className="px-3 py-2 font-mono text-[13px]">{a.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
