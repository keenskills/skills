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
  return skill ? pageMeta({ title: `Changelog · ${skill.title}`, description: `Release notes for ${skill.title}: what changed in each version.`, path: `/${skill.slug}/changelog`, skill: skill.slug }) : {}
}

export default async function ChangelogPage({ params }: Props) {
  const skill = getSkill((await params).skill)
  if (!skill) notFound()
  return (
    <DocsShell skill={skill} active="changelog">
      <p className="text-sm text-muted">{skill.title}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Changelog</h1>
      <div className="mt-6">
        <Prose html={skill.changelog} />
      </div>
    </DocsShell>
  )
}
