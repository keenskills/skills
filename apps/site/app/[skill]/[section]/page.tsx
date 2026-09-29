import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DocsShell } from '@/components/docs-shell'
import { Prose } from '@/components/prose'
import { getSkill, skills } from '@/lib/content'

type Props = { params: Promise<{ skill: string; section: string }> }

export const dynamicParams = false
export const generateStaticParams = () => skills.flatMap((s) => s.sections.map((x) => ({ skill: s.slug, section: x.slug })))

async function find(params: Props['params']) {
  const { skill: slug, section } = await params
  const skill = getSkill(slug)
  const i = skill?.sections.findIndex((x) => x.slug === section) ?? -1
  return skill && i >= 0 ? { skill, i } : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await find(params)
  return found ? { title: `${found.skill.sections[found.i].heading} · ${found.skill.title}` } : {}
}

export default async function SectionPage({ params }: Props) {
  const found = await find(params)
  if (!found) notFound()
  const { skill, i } = found
  const section = skill.sections[i]
  const prev = skill.sections[i - 1]
  const next = skill.sections[i + 1]
  return (
    <DocsShell skill={skill} active={section.slug}>
      <p className="text-sm text-muted">{skill.title}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{section.heading}</h1>
      <div className="mt-6">
        <Prose html={section.html} />
      </div>
      <nav aria-label="Previous and next" className="mt-12 flex justify-between gap-4 border-t border-border pt-6 text-sm">
        {prev ? (
          <Link href={`/${skill.slug}/${prev.slug}`} className="inline-flex min-h-6 items-center gap-1 text-accent hover:underline">
            <span aria-hidden="true">←</span> {prev.heading}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/${skill.slug}/${next.slug}`} className="inline-flex min-h-6 items-center gap-1 text-right text-accent hover:underline">
            {next.heading} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </nav>
    </DocsShell>
  )
}
