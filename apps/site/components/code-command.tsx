import { CopyButton } from './copy-button'

export function CodeCommand({ command, label }: { command: string; label?: string }) {
  return (
    <figure className="min-w-0">
      {label ? <figcaption className="mb-2 text-xs text-muted">{label}</figcaption> : null}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-code py-1.5 pl-3 pr-1.5">
        <pre tabIndex={0} className="min-w-0 flex-1 overflow-x-auto font-mono text-[13px] leading-6">
          <code>{command}</code>
        </pre>
        <CopyButton text={command} ariaLabel={`Copy ${label ?? 'command'}`} />
      </div>
    </figure>
  )
}
