import type { Metadata } from 'next'
import { pageMeta } from '@/lib/meta'
import { notFound } from 'next/navigation'
import { DocsShell } from '@/components/docs-shell'
import { Prose } from '@/components/prose'
import { getSkill, skills } from '@/lib/content'

type Props = { params: Promise<{ skill: string }> }

export const dynamicParams = false
export const generateStaticParams = () => skills.map((s) => ({ skill: s.slug }))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const skill = getSkill((await params).skill)
  return skill ? pageMeta({ title: `What your agent reads · ${skill.title}`, description: `The skill file ${skill.title} installs for your coding agent, word for word.`, path: `/${skill.slug}/skill`, skill: skill.slug }) : {}
}

export default async function SkillFilePage({ params }: Props) {
  const skill = getSkill((await params).skill)
  if (!skill) notFound()
  return (
    <DocsShell skill={skill} active="skill">
      <p className="text-sm text-muted">{skill.title}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">What your agent reads</h1>
      <p className="mt-3 text-muted text-pretty">This is the skill text init installs. Your agent loads it when a task matches.</p>
      <div className="mt-8 rounded-xl border border-border bg-surface p-5 sm:p-6">
        <Prose html={skill.skill} />
      </div>
    </DocsShell>
  )
}
