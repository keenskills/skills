import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DocsShell } from '@/components/docs-shell'
import { Prose } from '@/components/prose'
import { SkillHeader } from '@/components/skill-header'
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
      <div className="mt-8">
        <Prose html={skill.intro} />
      </div>
      <h2 className="mt-12 text-xl font-semibold tracking-tight">Docs</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {skill.sections.map((s) => (
          <li key={s.slug}>
            <Link href={`/${skill.slug}/${s.slug}`} className="block rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium hover:bg-accent-soft">
              {s.heading}
            </Link>
          </li>
        ))}
      </ul>
    </DocsShell>
  )
}
