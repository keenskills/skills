import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CodeCommand } from '@/components/code-command'
import { DocsShell } from '@/components/docs-shell'
import { PmCommand } from '@/components/pm-command'
import { PromptGallery } from '@/components/prompt-gallery'
import { Prose } from '@/components/prose'
import { SkillHeader } from '@/components/skill-header'
import { SkillTabs } from '@/components/skill-tabs'
import { getSkill, skills } from '@/lib/content'

type Props = { params: Promise<{ skill: string }> }

export const dynamicParams = false
export const generateStaticParams = () => skills.map((s) => ({ skill: s.slug }))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const skill = getSkill((await params).skill)
  return skill ? { title: skill.title, description: skill.summary } : {}
}

export default async function SkillPage({ params }: Props) {
  const skill = getSkill((await params).skill)
  if (!skill) notFound()
  return (
    <DocsShell skill={skill} active="">
      <SkillHeader skill={skill} />
      <SkillTabs
        panels={{
          preview: <Prose html={skill.intro} />,
          install: (
            <div className="grid gap-5">
              <h2 className="text-xl font-semibold tracking-tight">Install &amp; usage</h2>
              <PmCommand pkg={skill.name} args="init" label="This project, for the agents it uses" name="install" />
              <PmCommand pkg={skill.name} args="init --dry-run" label="See the plan first, write nothing" name="dry-run" switcher={false} />
              <CodeCommand label="As a Claude Code plugin" command={`/plugin marketplace add keenskills/skills\n/plugin install ${skill.pkg}@keenskills`} />
              <Link href="/how-to-use" className="text-sm font-medium text-accent hover:underline">
                Every option, per agent
              </Link>
            </div>
          ),
          prompts: skill.gallery.length ? <PromptGallery gallery={skill.gallery} /> : undefined,
        }}
      />
      <h2 className="mt-12 text-xl font-semibold tracking-tight">Docs</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {skill.sections.map((s) => (
          <li key={s.slug}>
            <Link href={`/${skill.slug}/${s.slug}`} className="card card-hover block px-4 py-3 text-sm font-medium">
              {s.heading}
            </Link>
          </li>
        ))}
      </ul>
    </DocsShell>
  )
}
