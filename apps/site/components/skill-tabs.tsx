'use client'
import { useState, type ReactNode } from 'react'
import { SlidingTabs } from './sliding-tabs'

type Panels = { preview: ReactNode; install: ReactNode; prompts?: ReactNode }

// Every panel is in the server HTML (inactive ones hidden), so the text is
// crawlable and the page works before hydration.
export function SkillTabs({ panels }: { panels: Panels }) {
  const options = [
    { id: 'preview', label: 'Preview' },
    { id: 'install', label: 'Install & Usage' },
    ...(panels.prompts ? [{ id: 'prompts', label: 'Prompts' }] : []),
  ]
  const [tab, setTab] = useState('preview')
  return (
    <section className="mt-10" aria-label="Skill">
      <SlidingTabs label="Skill" options={options} value={tab} onChange={setTab} idPrefix="skill" panelId={(id) => `panel-${id}`} />
      {options.map((o) => (
        <div key={o.id} id={`panel-${o.id}`} role="tabpanel" aria-labelledby={`skill-tab-${o.id}`} hidden={tab !== o.id} className="mt-6">
          {panels[o.id as keyof Panels]}
        </div>
      ))}
    </section>
  )
}
