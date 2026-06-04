export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-28 rounded-lg bg-muted" />
        <div className="mt-1.5 h-4 w-56 rounded bg-muted" />
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="h-5 w-48 rounded bg-muted" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-16 rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-9 w-full rounded-lg bg-muted" />
      </div>
    </div>
  );
}
