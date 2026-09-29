export function CodeCommand({ command, label }: { command: string; label?: string }) {
  return (
    <figure className="min-w-0">
      {label ? <figcaption className="mb-1.5 text-xs text-muted">{label}</figcaption> : null}
      <pre className="overflow-x-auto rounded-lg border border-border bg-code px-3 py-2.5 font-mono text-[13px] leading-6">
        <code>{command}</code>
      </pre>
    </figure>
  )
}
