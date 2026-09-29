import type { Gallery } from '@/lib/content'
import { CopyButton } from './copy-button'

export function PromptGallery({ gallery }: { gallery: Gallery[] }) {
  return (
    <div className="grid gap-8">
      <h2 className="text-xl font-semibold tracking-tight">Example prompts</h2>
      {gallery.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h3 className="font-medium">{g.title}</h3>
          {g.note ? <p className="mt-1 text-sm text-muted text-pretty">{g.note}</p> : null}
          <ul className="mt-3 grid gap-2">
            {g.prompts.map((p) => (
              <li key={p} className="card flex items-start gap-3 p-3">
                <p className="min-w-0 flex-1 text-sm text-pretty">{p}</p>
                <CopyButton text={p} ariaLabel={`Copy the prompt: ${p.slice(0, 48)}`} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
