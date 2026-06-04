export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-24 rounded-lg bg-muted" />
        <div className="mt-1.5 h-4 w-52 rounded bg-muted" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-20 rounded bg-muted" />
          <div className="flex items-center gap-1">
            <div className="h-7 w-7 rounded-md bg-muted" />
            <div className="h-5 w-24 rounded bg-muted" />
            <div className="h-7 w-7 rounded-md bg-muted" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-border">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="py-2 flex justify-center">
                <div className="h-4 w-4 rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-[52px] border-b border-r border-border/40 p-1.5">
                <div className="h-6 w-6 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
