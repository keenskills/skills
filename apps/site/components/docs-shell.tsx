import type { Skill } from '@/lib/content'
import { DocsSidebar } from './docs-sidebar'

export function DocsShell({ skill, active, children }: { skill: Skill; active: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-8 py-10 md:grid-cols-[220px_minmax(0,1fr)] md:gap-12">
      <aside className="min-w-0">
        <DocsSidebar skill={skill} active={active} />
      </aside>
      <div className="min-w-0 max-w-3xl">{children}</div>
    </div>
  )
}
