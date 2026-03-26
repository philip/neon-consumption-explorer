export function CurlBlock({ cmd }: { cmd: string }) {
  return (
    <pre className="overflow-x-auto rounded bg-muted p-3 text-xs font-mono leading-relaxed">
      {cmd}
    </pre>
  )
}
